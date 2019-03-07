<template>
  <modal>
    <h2 slot="header">Transfer</h2>
    <div slot="body">
      <div class="popup-from-address">
        From address:
        <span class="mono">{{ activeAccount.address }}</span>
      </div>
      <div style="display: inline-block">
        <div class="popup-input">
          Token:
          <select id="transferCurrency" v-model="transferCurrency">
            <option
              v-for="balance in activeAccount.childBalance"
              v-bind:value="balance.currency"
            >{{ balance.symbol != 'Unknown ERC20' ? balance.symbol : balance.currency }}</option>
          </select>
        </div>
        <div class="popup-input">
          To address:
          <input v-model="transferToAddress">
        </div>
        <div class="popup-input">
          Amount:
          <input v-model="transferAmount">
        </div>
        <div class="popup-input">
          include fee
          <input type="checkbox" v-model="transferZeroFee">
        </div>
      </div>
      <div>
        <button v-on:click="transfer(); $emit('close')">OK</button>
        <button v-on:click="$emit('close')">Cancel</button>
      </div>
    </div>
  </modal>
</template>

<script>
import modal from "./Modal.vue";
import erc20abi from "./erc20abi";
import awaitTx from "./awaitTx";
import * as Promise from "bluebird";

export default {
  components: {
    modal
  },

  props: {
    OmgUtil: Object,
    activeAccount: Object,
    childChain: Object
  },

  data() {
    return {
      transferCurrency: this.OmgUtil.transaction.ETH_CURRENCY,
      transferAmount: 10,
      transferToAddress: this.OmgUtil.transaction.ETH_CURRENCY,
      transferZeroFee: true
    };
  },

  methods: {
    transfer: async function() {
      const tokenContract =
        this.transferCurrency || this.OmgUtil.transaction.ETH_CURRENCY;
      const fromAddr = this.activeAccount.address;
      const toAddr = this.transferToAddress;
      const value = this.transferAmount;

      const utxos = await this.childChain.getUtxos(fromAddr);
      const utxosToSpend = this.selectUtxos(
        utxos,
        value,
        tokenContract,
        this.transferZeroFee
      );
      if (!utxosToSpend) {
        this.error(`No utxo big enough to cover the amount ${value}`);
        return;
      }

      const txBody = {
        inputs: utxosToSpend,
        outputs: [
          {
            owner: toAddr,
            currency: tokenContract,
            amount: Number(value)
          }
        ]
      };

      if (utxosToSpend[0].amount > value) {
        // Need to add a 'change' output
        const CHANGE_AMOUNT = utxosToSpend[0].amount - value;
        txBody.outputs.push({
          owner: fromAddr,
          currency: tokenContract,
          amount: CHANGE_AMOUNT
        });
      }

      if (this.transferZeroFee && utxosToSpend.length > 1) {
        // The fee input can be returned
        txBody.outputs.push({
          owner: fromAddr,
          currency: utxosToSpend[utxosToSpend.length - 1].currency,
          amount: utxosToSpend[utxosToSpend.length - 1].amount
        });
      }

      try {
        // Create the unsigned transaction
        const unsignedTx = this.childChain.createTransaction(txBody);

        // TODO sign each input

        web3.personal.sign(unsignedTx, this.activeAccount.address, function(
          err,
          result
        ) {
          if (err) return console.error(err);
          console.log("PERSONAL SIGNED:" + result);
        });

        // // Sign the transaction with the private key
        // const keys = new Array(txBody.inputs.length).fill(privateKey);
        // const signatures = await this.childChain.signTransaction(
        //   unsignedTx,
        //   keys
        // );
        // // Build the signed transaction
        // const signedTx = await this.childChain.buildSignedTransaction(
        //   unsignedTx,
        //   signatures
        // );
        // // Submit the signed transaction to the childchain
        // const result = await this.childChain.submitTransaction(signedTx);
        // this.info(`Submitted transaction: ${JSON.stringify(result)}`);
      } catch (err) {
        this.$parent.error(err);
      }
    },

    selectUtxos: function(utxos, amount, currency, includeFee) {
      const correctCurrency = utxos.filter(utxo => utxo.currency === currency);
      // TODO add utxos
      // Just find the first utxo that can fulfill the amount
      const selected = correctCurrency.find(utxo => utxo.amount >= amount);
      if (selected) {
        const ret = [selected];
        if (includeFee) {
          // Find the first ETH utxo (that's not selected)
          const ethUtxos = utxos.filter(
            utxo => utxo.currency === this.OmgUtil.transaction.ETH_CURRENCY
          );
          const feeUtxo = ethUtxos.find(utxo => utxo !== selected);
          ret.push(feeUtxo);
        }
        return ret;
      }
    }
  }
}
</script>
