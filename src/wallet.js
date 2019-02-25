
const localConfig = {
  web3ProviderUrl: 'http://localhost:8545',
  watcherUrl: 'http://localhost:7434',
  childchainUrl: 'http://localhost:9656',
  plasmaContractAddress: '0x9ea1e52e0e4ef1bf31a09fbf477f2aedf07bf64d'
}

const config = localConfig

const erc20MinimalAbi = [
  {
    'constant': false,
    'inputs': [
      {
        'name': '_spender',
        'type': 'address'
      },
      {
        'name': '_value',
        'type': 'uint256'
      }
    ],
    'name': 'approve',
    'outputs': [
      {
        'name': 'success',
        'type': 'bool'
      }
    ],
    'payable': false,
    'stateMutability': 'nonpayable',
    'type': 'function'
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'name',
    'outputs': [
      {
        'name': '',
        'type': 'string'
      }
    ],
    'payable': false,
    'type': 'function'
  },
  {
    'constant': true,
    'inputs': [],
    'name': 'symbol',
    'outputs': [
      {
        'name': '',
        'type': 'string'
      }
    ],
    'payable': false,
    'type': 'function'
  }
]

var web3 = new Web3()
let globalKeystore
let rootChain
let childChain

const MAX_LOGS = 5

Vue.component('modal', {
  template: '#modal-template'
})

const vm = new Vue({
  el: '#app',
  data: {
    accounts: [{ address: '0x0', rootBalance: 0 }],
    activeAccount: {},
    loadWallet: true,
    depositCurrency: '',
    depositAmount: 0,
    approveDeposit: false,
    transferToAddress: '0xde5c92dab7562d02cf8beb2ef9a176fb3f5d2750',
    transferCurrency: '',
    transferAmount: 0,
    isShowDeposit: false,
    isShowExit: false,
    isShowTransfer: false,
    utxos: [],
    utxoToExit: '',
    transferZeroFee: false,
    logs: []
  },
  methods: {
    log: function (message) {
      if (this.logs.length >= MAX_LOGS) {
        this.logs.shift()
      }
      this.logs.push(message)
    },
    info: function (message) {
      this.log({ message, level: 'info' })
    },
    error: function (message) {
      this.log({ message, level: 'error' })
    },

    removeLog: function (log) {
      this.logs = this.logs.filter(item => item !== log)
    },

    restoreSeed: async function () {
      var password = prompt('Enter Password to encrypt your seed', 'Password')
      try {
        const addresses = await createVault(password, this.seed)

        this.accounts = addresses.map(address => ({ address, rootBalance: 0, childBalance: 0 }))
        this.activeAccount = this.accounts[0]
        this.refresh()
        this.loadWallet = false
      } catch (err) {
        this.error(err)
      }
    },

    refresh: function () {
      getBalances(this.activeAccount)
      this.getUtxos()
    },

    deposit: async function () {
      const tokenContract = this.depositCurrency || OmgUtil.transaction.ETH_CURRENCY
      const from = this.activeAccount.address
      const value = this.depositAmount

      // Create the deposit transaction
      const depositTx = OmgUtil.transaction.encodeDeposit(from, value, tokenContract)

      if (tokenContract === OmgUtil.transaction.ETH_CURRENCY) {
        try {
          const tx = await rootChain.depositEth(depositTx, value, { from })
          this.info(`Deposited ${value} ETH: ${tx.transactionHash}`)
        } catch (err) {
          this.error(err)
        }
      } else {
        if (this.approveDeposit) {
          this.approveDeposit = false
          // First approve the plasma contract on the erc20 contract
          const erc20 = web3.eth.contract(erc20MinimalAbi).at(tokenContract)
          const approvePromise = Promise.promisify(erc20.approve.sendTransaction)

          try {
            const gasPrice = web3.eth.gasPrice
            const tx = await approvePromise(config.plasmaContractAddress, value, { from, gasPrice, gas: 2000000 })
            // Wait for the approve tx to be mined
            this.info(`${value} erc20 approved: ${tx}. Waiting for confirmation...`)
            await awaitTx(web3, tx)
            this.info(`... ${tx} confirmed.`)
          } catch (err) {
            this.error(err)
            return
          }
        }

        try {
          const tx = await rootChain.depositToken(depositTx, { from })
          this.info(`Deposited ${value} ${tokenContract} tokens: ${tx.transactionHash}`)
        } catch (err) {
          this.error(err)
        }
      }
    },

    transfer: async function () {
      const tokenContract = this.transferCurrency || OmgUtil.transaction.ETH_CURRENCY
      const fromAddr = this.activeAccount.address
      const toAddr = this.transferToAddress
      const value = this.transferAmount

      const utxos = await childChain.getUtxos(fromAddr)
      const utxosToSpend = selectUtxos(utxos, value, tokenContract, this.transferZeroFee)
      if (!utxosToSpend) {
        this.error(`No utxo big enough to cover the amount ${value}`)
        return
      }

      const txBody = {
        inputs: utxosToSpend,
        outputs: [{
          owner: toAddr,
          currency: tokenContract,
          amount: Number(value)
        }]
      }

      if (utxosToSpend[0].amount > value) {
        // Need to add a 'change' output
        const CHANGE_AMOUNT = utxosToSpend[0].amount - value
        txBody.outputs.push({
          owner: fromAddr,
          currency: tokenContract,
          amount: CHANGE_AMOUNT
        })
      }

      if (this.transferZeroFee && utxosToSpend.length > 1) {
        // The fee input can be returned
        txBody.outputs.push({
          owner: fromAddr,
          currency: utxosToSpend[utxosToSpend.length - 1].currency,
          amount: utxosToSpend[utxosToSpend.length - 1].amount
        })
      }

      try {
        // Create the unsigned transaction
        const unsignedTx = childChain.createTransaction(txBody)

        const password = prompt('Enter password', 'Password')

        // Sign it
        globalKeystore.keyFromPassword(password, async (err, pwDerivedKey) => {
          if (err) {
            this.error(err)
            return
          }
          try {
            // Decrypt the private key
            const privateKey = globalKeystore.exportPrivateKey(fromAddr, pwDerivedKey)
            // Sign the transaction with the private key
            const keys = new Array(txBody.inputs.length).fill(privateKey)
            const signatures = await childChain.signTransaction(unsignedTx, keys)
            // Build the signed transaction
            const signedTx = await childChain.buildSignedTransaction(unsignedTx, signatures)
            // Submit the signed transaction to the childchain
            const result = await childChain.submitTransaction(signedTx)
            this.info(`Submitted transaction: ${JSON.stringify(result)}`)
          } catch (err) {
            this.error(err)
          }
        })
      } catch (err) {
        this.error(err)
      }
    },

    exit: async function () {
      const fromAddr = this.activeAccount.address
      const utxoToExit = this.utxoToExit
      try {
        const exitData = await childChain.getExitData(utxoToExit)

        let receipt = await rootChain.startStandardExit(
          exitData.utxo_pos,
          exitData.txbytes,
          exitData.proof,
          {
            from: fromAddr
          }
        )
        this.utxoToExit = ''
        this.info(`Called RootChain.startExit(): ${receipt.transactionHash}`)
      } catch (err) {
        this.error(err)
      }
    },

    getUtxos: async function () {
      this.utxos = await childChain.getUtxos(this.activeAccount.address)
    },

    toggleDeposit () {
      this.isShowDeposit = !this.isShowDeposit
    },
    toggleTransfer () {
      this.isShowTransfer = !this.isShowTransfer
    },
    toggleExit () {
      this.isShowExit = !this.isShowExit
    }
  }
})

function createVault (password, seed) {
  return new Promise((resolve, reject) => {
    lightwallet.keystore.createVault({
      password: password,
      seedPhrase: seed,
      hdPathString: "m/0'/0'/0'"
    }, (err, keystore) => {
      if (err) {
        reject(err)
        return
      }

      globalKeystore = keystore

      const web3Provider = new HookedWeb3Provider({
        host: config.web3ProviderUrl,
        transaction_signer: globalKeystore
      })
      web3.setProvider(web3Provider)

      rootChain = new RootChain(web3Provider, config.plasmaContractAddress)
      childChain = new ChildChain(config.watcherUrl, config.childchainUrl)

      globalKeystore.keyFromPassword(password, (err, pwDerivedKey) => {
        if (err) {
          reject(err)
          return
        }

        // Get the first address in the wallet
        globalKeystore.generateNewAddress(pwDerivedKey, 1)
        const addresses = globalKeystore.getAddresses()
        resolve(addresses)
      })
    })
  })
}

async function getBalances (account) {
  web3.eth.getBalance(account.address, (err, ethBalance) => {
    if (err) {
      vm.error(err)
      return
    }
    account.rootBalance = ethBalance
  })

  const childchainBalance = await childChain.getBalance(account.address)
  account.childBalance = childchainBalance
  account.childBalance.forEach(balance => {
    if (balance.currency === OmgUtil.transaction.ETH_CURRENCY) {
      balance.symbol = 'ETH'
    } else {
      const tokenContract = web3.eth.contract(erc20MinimalAbi).at(balance.currency)
      try {
        const tokenSymbol = tokenContract.symbol()
        balance.symbol = tokenSymbol
      } catch (err) {
        balance.symbol = 'Unknown ERC20'
      }
    }
  })
}

function selectUtxos (utxos, amount, currency, includeFee) {
  const correctCurrency = utxos.filter(utxo => utxo.currency === currency)
  // TODO add utxos
  // Just find the first utxo that can fulfill the amount
  const selected = correctCurrency.find(utxo => utxo.amount >= amount)
  if (selected) {
    const ret = [selected]
    if (includeFee) {
      // Find the first ETH utxo (that's not selected)
      const ethUtxos = utxos.filter(utxo => utxo.currency === OmgUtil.transaction.ETH_CURRENCY)
      const feeUtxo = ethUtxos.find(utxo => utxo !== selected)
      ret.push(feeUtxo)
    }
    return ret
  }
}

const DEFAULT_INTERVAL = 500
const DEFAULT_BLOCKS_TO_WAIT = 1

function awaitTx (web3, txnHash, options) {
  const interval = options && options.interval ? options.interval : DEFAULT_INTERVAL
  const blocksToWait = options && options.blocksToWait ? options.blocksToWait : DEFAULT_BLOCKS_TO_WAIT
  var transactionReceiptAsync = async function (txnHash, resolve, reject) {
    try {
      var receipt = web3.eth.getTransactionReceipt(txnHash)
      if (!receipt) {
        setTimeout(function () {
          transactionReceiptAsync(txnHash, resolve, reject)
        }, interval)
      } else {
        if (blocksToWait > 0) {
          var resolvedReceipt = await receipt
          if (!resolvedReceipt || !resolvedReceipt.blockNumber) {
            setTimeout(function () {
              transactionReceiptAsync(txnHash, resolve, reject)
            }, interval)
          } else {
            try {
              var block = await web3.eth.getBlock(resolvedReceipt.blockNumber)
              var current = await web3.eth.getBlock('latest')
              if (current.number - block.number >= blocksToWait) {
                var txn = await web3.eth.getTransaction(txnHash)
                if (txn.blockNumber != null) resolve(resolvedReceipt)
                else reject(new Error('Transaction with hash: ' + txnHash + ' ended up in an uncle block.'))
              } else {
                setTimeout(function () {
                  transactionReceiptAsync(txnHash, resolve, reject)
                }, interval)
              }
            } catch (e) {
              setTimeout(function () {
                transactionReceiptAsync(txnHash, resolve, reject)
              }, interval)
            }
          }
        } else resolve(receipt)
      }
    } catch (e) {
      reject(e)
    }
  }

  if (Array.isArray(txnHash)) {
    var promises = []
    txnHash.forEach(function (oneTxHash) {
      promises.push(awaitTx(web3, oneTxHash, options))
    })
    return Promise.all(promises)
  } else {
    return new Promise(function (resolve, reject) {
      transactionReceiptAsync(txnHash, resolve, reject)
    })
  }
};
