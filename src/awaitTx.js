
import * as Promise from 'bluebird'

const DEFAULT_INTERVAL = 1000
const DEFAULT_BLOCKS_TO_WAIT = 1

function awaitTx (web3, txnHash, options) {
  const getTransactionReceiptPromise = Promise.promisify(web3.eth.getTransactionReceipt)
  const getBlockPromise = Promise.promisify(web3.eth.getBlock)
  const getTransactionPromise = Promise.promisify(web3.eth.getTransaction)

  const interval = options && options.interval ? options.interval : DEFAULT_INTERVAL
  const blocksToWait = options && options.blocksToWait ? options.blocksToWait : DEFAULT_BLOCKS_TO_WAIT
  var transactionReceiptAsync = async function (txnHash, resolve, reject) {
    try {
      var receipt = await getTransactionReceiptPromise(txnHash)
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
              var block = await getBlockPromise(resolvedReceipt.blockNumber)
              var current = await getBlockPromise('latest')
              if (current.number - block.number >= blocksToWait) {
                var txn = await getTransactionPromise(txnHash)
                if (txn.blockNumber != null) {
                  resolve(resolvedReceipt)
                } else {
                  reject(new Error('Transaction with hash: ' + txnHash + ' ended up in an uncle block.'))
                }
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

export default awaitTx
