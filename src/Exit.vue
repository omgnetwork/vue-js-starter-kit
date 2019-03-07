<template>
  <modal>
    <h2 slot="header">Exit</h2>
    <div slot="body">
      <div class="popup-from-address">
        From address:
        <span class="mono">{{ activeAccount.address }}</span>
      </div>
      <div style="display: inline-block">
        <div class="popup-input">
          <select id="exitUtxo" v-model="utxoToExit">
            <option disabled value>Select a UTXO to exit</option>
            <option
              v-for="utxo in utxos"
              v-bind:value="utxo"
            >{{ utxo.currency }} : {{ utxo.amount }}</option>
          </select>
        </div>
      </div>
      <div>
        <button v-on:click="exit(); $emit('close')">OK</button>
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
    activeAccount: Object,
    rootChain: Object,
    childChain: Object,
    utxos: Array
  },

  data() {
    return {
      utxoToExit: ""
    };
  },

  methods: {
    exit: async function() {
      const fromAddr = this.activeAccount.address;
      const utxoToExit = this.utxoToExit;
      try {
        const exitData = await this.childChain.getExitData(utxoToExit);

        let receipt = await this.rootChain.startStandardExit(
          Number(exitData.utxo_pos.toString()),
          exitData.txbytes,
          exitData.proof,
          {
            from: fromAddr
          }
        );
        this.utxoToExit = "";
        this.$parent.info(`Called RootChain.startExit(): ${receipt.transactionHash}`);
      } catch (err) {
        this.$parent.error(err);
      }
    }
  }
};
</script>
