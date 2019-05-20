const domainSpec = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'verifyingContract', type: 'address' },
  { name: 'salt', type: 'bytes32' }
]

const txSpec = [
  { name: 'input0', type: 'Input' },
  { name: 'input1', type: 'Input' },
  { name: 'input2', type: 'Input' },
  { name: 'input3', type: 'Input' },
  { name: 'output0', type: 'Output' },
  { name: 'output1', type: 'Output' },
  { name: 'output2', type: 'Output' },
  { name: 'output3', type: 'Output' },
  { name: 'metadata', type: 'bytes32' }
]

const inputSpec = [
  { name: 'blknum', type: 'uint256' },
  { name: 'txindex', type: 'uint256' },
  { name: 'oindex', type: 'uint256' }
]

const outputSpec = [
  { name: 'owner', type: 'address' },
  { name: 'currency', type: 'address' },
  { name: 'amount', type: 'uint256' }
]

const domainData = {
  name: 'OMG Network',
  version: '1',
  verifyingContract: '0x2f384cbfa8c0a8b48acba276c58cb859a6232d2f',
  salt: '0xfad5c7f626d80f9256ef01929f3beb96e058b8b4b0e3fe52d84f054c0e2a7a83'
}

const typedData = {
  types: {
    EIP712Domain: domainSpec,
    Transaction: txSpec,
    Input: inputSpec,
    Output: outputSpec
  },
  domain: domainData,
  primaryType: 'Transaction'
}

function getTypedData (tx) {
  // Outputs use 'token' instead of 'currency', may be changed in the future
  const tokenOutputs = tx.outputs.map(o => ({
    owner: o.owner,
    currency: o.currency,
    amount: o.amount.toString()
  }))

  typedData.message = {
    input0: tx.inputs[0],
    input1: tx.inputs[1],
    input2: tx.inputs[2],
    input3: tx.inputs[3],
    output0: tokenOutputs[0],
    output1: tokenOutputs[1],
    output2: tokenOutputs[2],
    output3: tokenOutputs[3],
    metadata: '0x0000000000000000000000000000000000000000000000000000000000000000'
  }

  return JSON.stringify(typedData)
}

module.exports = getTypedData
