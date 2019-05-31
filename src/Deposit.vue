<template>
  <modal>
    <h2 slot="header">Deposit</h2>
    <div slot="body">
      <div class="popup-from-address">
        From address:
        <span class="mono">{{ activeAccount.address }}</span>
      </div>
      <div style="display: inline-block">
        <div class="popup-input">
          Token contract address (blank for ETH):
          <input v-model="depositCurrency" size="30">
        </div>
        <div class="popup-input">
          Amount
          <input v-model="depositAmount" size="30">
        </div>
        <div class="popup-input">
          approve ERC20 token before deposit
          <input type="checkbox" v-model="approveDeposit">
        </div>
      </div>
      <div>
        <md-button v-on:click="deposit(); $emit('close')" class="md-raised">Ok</md-button>
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
    OmgUtil: Object,
    activeAccount: Object,
    rootChain: Object,
    plasmaContractAddress: String
  },

  data() {
    return {
      depositCurrency: "",
      depositAmount: 0,
      approveDeposit: false
    }
  },

  methods: {
    deposit: async function() {
      try {
        const tokenContract = this.depositCurrency || this.OmgUtil.transaction.ETH_CURRENCY
        const from = this.activeAccount.address
        const value = this.depositAmount

        const tx = await omgNetwork.deposit(
          web3, 
          this.rootChain, 
          from, 
          value, 
          tokenContract,
          this.approveDeposit
        )
        this.approveDeposit = false
        this.$parent.info(`Deposited ${value} ${tokenContract === this.OmgUtil.transaction.ETH_CURRENCY ? 'ETH' : tokenContract} tokens: ${tx.transactionHash}`)
      } catch (err) {
        this.$parent.error(err)
      }
    }
  }
}
</script>
