
const WEB3_PROVIDER_URL = 'https://rinkeby.infura.io/'
const WATCHER_URL = ''
const CHILDCHAIN_URL = ''
const PLASMA_CONTRACT_ADDRESS = '0x5bb7f2492487556e380e0bf960510277cdafd680'

const erc20InfoAbi = [
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
    isShowDeposit: false,
    isShowExit: false,
    isShowTransfer: false
  },
  methods: {
    restoreSeed: function () {
      var password = prompt('Enter Password to encrypt your seed', 'Password')
      createVault(password, this.seed)
      this.loadWallet = false
    },

    refresh: function () {
      showBalance(this.activeAccount)
    },

    deposit: function () {
      const tokenContract = this.depositCurrency || OmgUtil.transaction.ETH_CURRENCY
      const from = this.activeAccount.address
      const value = this.depositAmount

      // Create the deposit transaction
      const depositTx = OmgUtil.transaction.encodeDeposit(from, value, tokenContract)
      console.log(depositTx)

      if (tokenContract === OmgUtil.transaction.ETH_CURRENCY) {
        rootChain.depositEth(depositTx, value, { from })
          .then(txhash => {
            console.log('txhash: ' + txhash.transactionHash)
          })
          .catch(console.error)
      } else {
        rootChain.depositToken(depositTx, { from })
          .then(txhash => {
            console.log('txhash: ' + txhash.transactionHash)
          })
      }
    },

    showDeposit() {
      this.isShowDeposit = !this.isShowDeposit;
    },
    showTransfer() {
      this.isShowTransfer = !this.isShowTransfer;
    },
    showExit() {
      this.isShowExit = !this.isShowExit;
    }
  }
})

var web3 = new Web3()
let globalKeystore
let rootChain
let childChain

function createVault (password, seed) {
  lightwallet.keystore.createVault({
    password: password,
    seedPhrase: seed,
    hdPathString: "m/0'/0'/0'"
  }, (err, keystore) => {
    if (err) {
      console.error(err)
      return
    }

    globalKeystore = keystore

    const web3Provider = new HookedWeb3Provider({
      host: WEB3_PROVIDER_URL,
      transaction_signer: globalKeystore
    })
    web3.setProvider(web3Provider)

    rootChain = new RootChain(web3Provider, PLASMA_CONTRACT_ADDRESS)
    childChain = new ChildChain(WATCHER_URL, CHILDCHAIN_URL)

    globalKeystore.keyFromPassword(password, (err, pwDerivedKey) => {
      if (err) {
        console.error(err)
        return
      }

      // Show the first 2 addresses in the wallet
      globalKeystore.generateNewAddress(pwDerivedKey, 1)
      const addresses = globalKeystore.getAddresses()
      vm.accounts = addresses.map(address => ({ address, rootBalance: 0, childBalance: 0 }))
      vm.activeAccount = vm.accounts[0]
      showBalance(vm.activeAccount)
    })
  })
}

async function showBalance (account) {
  web3.eth.getBalance(account.address, (err, ethBalance) => {
    if (err) {
      console.error(err)
      return
    }
    account.rootBalance = ethBalance
  })
  childChain.getBalance(account.address).then(childchainBalance => {
    account.childBalance = childchainBalance
    account.childBalance.forEach(balance => {
      if (balance.currency === OmgUtil.transaction.ETH_CURRENCY) {
        balance.symbol = 'ETH'
      } else {
        const tokenContract = web3.eth.contract(erc20InfoAbi).at(balance.currency)
        try {
          const tokenSymbol = tokenContract.symbol()
          balance.symbol = tokenSymbol
        } catch (err) {
          // console.error(err)
        }
      }
    })
  })
}

async function childchainTransfer () {
  var fromAddr = document.getElementById('transferFromAddress').value
  var toAddr = document.getElementById('transferToAddress').value
  var tokenContract = document.getElementById('transferContractAddress').value
  tokenContract = tokenContract || OmgUtil.transaction.ETH_CURRENCY
  var value = document.getElementById('transferValue').value

  const utxos = await childChain.getUtxos(fromAddr)
  const utxosToSpend = selectUtxos(utxos, value, tokenContract)
  if (!utxosToSpend) {
    alert(`No utxo big enough to cover the amount ${value}`)
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

  // Create the unsigned transaction
  const unsignedTx = childChain.createTransaction(txBody)

  const password = prompt('Enter password', 'Password')

  // Sign it
  globalKeystore.keyFromPassword(password, async function (err, pwDerivedKey) {
    if (err) {
      console.error(err)
      return
    }
    // Decrypt the private key
    const privateKey = globalKeystore.exportPrivateKey(fromAddr, pwDerivedKey)
    // Sign the transaction with the private key
    const signatures = await childChain.signTransaction(unsignedTx, [privateKey])
    // Build the signed transaction
    const signedTx = await childChain.buildSignedTransaction(unsignedTx, signatures)
    // Submit the signed transaction to the childchain
    const result = await childChain.submitTransaction(signedTx)
    console.log(`Submitted transaction: ${JSON.stringify(result)}`)
  })
}

function selectUtxos (utxos, amount, currency) {
  const correctCurrency = utxos.filter(utxo => utxo.currency === currency)
  // Just find the first utxo that can fulfill the amount
  const selected = correctCurrency.find(utxo => utxo.amount >= amount)
  if (selected) {
    return [selected]
  }
}

async function startStandardExit () {
  var fromAddr = document.getElementById('exitFromAddress').value

  const utxos = await childChain.getUtxos(fromAddr)
  if (utxos.length > 0) {
    const exitData = await childChain.getExitData(utxos[0])

    let receipt = await rootChain.startStandardExit(
      exitData.utxo_pos,
      exitData.txbytes,
      exitData.proof,
      {
        from: fromAddr
      }
    )
    console.log(`RootChain.startExit(): txhash = ${receipt.transactionHash}`)
  }
}
