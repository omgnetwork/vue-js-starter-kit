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
        <md-button v-on:click="exit(); $emit('close')" class="md-raised">Ok</md-button>
        <md-button v-on:click="$emit('close')" class="md-raised">Cancel</md-button>
      </div>
    </div>
  </modal>
</template>

<script>
import modal from "./Modal.vue"
import omgNetwork from "./omg-network"

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
    }
  },

  methods: {
    exit: async function() {
      const fromAddr = this.activeAccount.address
      const utxoToExit = this.utxoToExit
      try {
        const receipt = await omgNetwork.exitUtxo(this.rootChain, this.childChain, fromAddr, utxoToExit)
        this.utxoToExit = ""
        this.$parent.info(`Called RootChain.startExit(): ${receipt.transactionHash}`)
      } catch (err) {
        this.$parent.error(err)
      }
    }
  }
}
</script>
