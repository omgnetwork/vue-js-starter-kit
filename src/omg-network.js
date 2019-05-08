
const erc20abi = require('human-standard-token-abi')
const { transaction } = require('@omisego/omg-js-util')
const numberToBN = require('number-to-bn')
const getTypedData = require('./typedData')

const omgNetwork = {
  getAccounts: async function (web3) {
    const accounts = await web3.eth.getAccounts()
    return accounts.map(address => ({
      address,
      rootBalance: 0,
      childBalance: 0
    }))
  },

  getUtxos: async function (childChain, account) {
    return childChain.getUtxos(account.address)
  },

  getTransactions: async function (childChain, account) {
    return childChain.getTransactions({
      address: account.address
    })
  },

  getBalances: async function (childChain, account, web3) {
    account.rootBalance = await web3.eth.getBalance(account.address)

    const childchainBalance = await childChain.getBalance(account.address)
    account.childBalance = await Promise.all(childchainBalance.map(
      async (balance) => {
        if (balance.currency === transaction.ETH_CURRENCY) {
          balance.symbol = 'ETH'
        } else {
          const tokenContract = new web3.eth.Contract(erc20abi, balance.currency)
          try {
            balance.symbol = await tokenContract.methods.symbol().call()
          } catch (err) {
            balance.symbol = 'Unknown ERC20'
          }
        }
        return balance
      }
    ))
  },

  transfer: async function (web3, childChain, from, to, amount, currency) {
    const transferZeroFee = currency !== transaction.ETH_CURRENCY
    const utxos = await childChain.getUtxos(from)
    const utxosToSpend = this.selectUtxos(
      utxos,
      amount,
      currency,
      transferZeroFee
    )
    if (!utxosToSpend) {
      throw new Error(`No utxo big enough to cover the amount ${amount}`)
    }

    const txBody = {
      inputs: utxosToSpend,
      outputs: [{
        owner: to,
        currency,
        amount: Number(amount)
      }]
    }

    const bnAmount = numberToBN(utxosToSpend[0].amount)
    if (bnAmount.gt(numberToBN(amount))) {
      // Need to add a 'change' output
      const CHANGE_AMOUNT = bnAmount.sub(numberToBN(amount))
      txBody.outputs.push({
        owner: from,
        currency,
        amount: CHANGE_AMOUNT
      })
    }

    if (transferZeroFee && utxosToSpend.length > 1) {
      // The fee input can be returned
      txBody.outputs.push({
        owner: from,
        currency: utxosToSpend[utxosToSpend.length - 1].currency,
        amount: utxosToSpend[utxosToSpend.length - 1].amount
      })
    }

    // Create the unsigned transaction
    const unsignedTx = childChain.createTransaction(txBody)
    const tx = transaction.decode(unsignedTx)

    const chainId = await web3.eth.net.getId()
    const typedData = getTypedData(web3, chainId, tx)

    // We should really sign each input separately but in this we know that they're all
    // from the same address, so we can sign once and use that signature for each input.
    //
    // const sigs = await Promise.all(utxosToSpend.map(input => signTypedData(web3, web3.utils.toChecksumAddress(from), typedData)))
    //
    const signature = await signTypedData(
      web3,
      web3.utils.toChecksumAddress(from),
      typedData
    )
    const sigs = new Array(utxosToSpend.length).fill(signature)

    // Build the signed transaction
    const signedTx = await childChain.buildSignedTransaction(unsignedTx, sigs)
    // Submit the signed transaction to the childchain
    return childChain.submitTransaction(signedTx)
  },

  selectUtxos: function (utxos, amount, currency, includeFee) {
    // Filter by desired currency and sort in descending order
    const sorted = utxos
      .filter(utxo => utxo.currency === currency)
      .sort((a, b) => numberToBN(b.amount).sub(numberToBN(a.amount)))

    if (sorted) {
      const selected = []
      let currentBalance = numberToBN(0)
      for (let i = 0; i < Math.min(sorted.length, 4); i++) {
        selected.push(sorted[i])
        currentBalance.iadd(numberToBN(sorted[i].amount))
        if (currentBalance.gte(numberToBN(amount))) {
          break
        }
      }

      if (currentBalance.gte(numberToBN(amount))) {
        if (includeFee) {
          // Find the first ETH utxo (that's not selected)
          const ethUtxos = utxos.filter(
            utxo => utxo.currency === transaction.ETH_CURRENCY
          )
          const feeUtxo = ethUtxos.find(utxo => utxo !== selected)
          if (!feeUtxo) {
            throw new Error(`Can't find a fee utxo for transaction`)
          } else {
            selected.push(feeUtxo)
          }
        }
        return selected
      }
    }
  }
}

function signTypedData (web3, signer, data) {
  return new Promise((resolve, reject) => {
    web3.currentProvider.sendAsync(
      {
        method: 'eth_signTypedData_v3',
        params: [signer, data],
        from: signer
      },
      (err, result) => {
        if (err) {
          reject(err)
        } else if (result.error) {
          reject(result.error.message)
        } else {
          resolve(result.result)
        }
      }
    )
  })
}

module.exports = omgNetwork
