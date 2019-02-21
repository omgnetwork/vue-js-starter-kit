const selector = {
  selectUtxos (utxos, amount) {
    // Split the utxos into arrays of higher and lower than amount
    const { highUtxos, lowUtxos } = splitHighLow(utxos, amount)

    // First try to satisfy the tx amount with low value utxos.
    // If there is a utxo of the exact tx amount it will be the first in this list.
    // Otherwise we'll use as few low value utxos as possible.
    const selected = fillWithLowValueUtxos(lowUtxos, amount)
    if (selected.length === 0) {
      // Couldn't fill with low values, take the next highest value (if any).
      if (highUtxos.length !== 0) {
        selected.push(highUtxos[0])
      }
    }

    // Calculate the total value of the selected utxos.
    const selectedTotal = selected.reduce((total, utxo) => total + utxo.amount, 0)

    // If not enough utxos were found, return null.
    if (selectedTotal < amount) {
      return null
    }

    // Change = value of all selected UTXOs - transaction value
    return { utxos: selected, change: selectedTotal - amount }
  }
}

function splitHighLow (utxos, limit) {
  // Split into high and low value utxos
  const splitUtxos = utxos.reduce(
    (acc, elem) => {
      if (elem.amount > limit) {
        acc[0].push(elem)
      } else {
        acc[1].push(elem)
      }
      return acc
    }, [[], []])

  return {
    highUtxos: splitUtxos[0].sort((a, b) => a.amount > b.amount), // Sort ascending
    lowUtxos: splitUtxos[1].sort((a, b) => a.amount < b.amount) // Sort descending
  }
}

function fillWithLowValueUtxos (lowValueUtxos, amount) {
  const selectedUtxos = []
  let totalValue = 0

  for (const utxo of lowValueUtxos) {
    selectedUtxos.push(utxo)
    totalValue += utxo.value
    if (totalValue >= amount) {
      return selectedUtxos
    }
  }
  // Can't fill the tx, return an empty array
  return []
}

module.exports = selector
