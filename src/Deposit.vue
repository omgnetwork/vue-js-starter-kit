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
        <button v-on:click="deposit(); $emit('close')">OK</button>
        <button v-on:click="$emit('close')">Cancel</button>
      </div>
    </div>
  </modal>
</template>

<script>
import modal from "./Modal.vue";
import erc20abi from "./erc20abi";
import awaitTx from "./awaitTx";
import * as Promise from 'bluebird'

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
    };
  },

  methods: {
    deposit: async function() {
      try {
        const tokenContract = this.depositCurrency || this.OmgUtil.transaction.ETH_CURRENCY;
        const from = this.activeAccount.address;
        const value = this.depositAmount;

        // Create the deposit transaction
        const depositTx = this.OmgUtil.transaction.encodeDeposit(
          from,
          value,
          tokenContract
        );

        if (tokenContract === this.OmgUtil.transaction.ETH_CURRENCY) {
          const tx = await this.rootChain.depositEth(depositTx, value, { from });
          this.$parent.info(`Deposited ${value} ETH: ${tx.transactionHash}`);
        } else {
          if (this.approveDeposit) {
            this.approveDeposit = false;
            // First approve the plasma contract on the erc20 contract
            const erc20 = web3.eth.contract(erc20abi).at(tokenContract);
            const approvePromise = Promise.promisify(erc20.approve.sendTransaction);

            // TODO
            const gasPrice = 1000000
            const tx = await approvePromise(
              this.plasmaContractAddress,
              value,
              { from, gasPrice, gas: 2000000 }
            );
            // Wait for the approve tx to be mined
            this.$parent.info(`${value} erc20 approved: ${tx}. Waiting for confirmation...`);
            await awaitTx(web3, tx);
            this.$parent.info(`... ${tx} confirmed.`);
          }

          const tx = await this.rootChain.depositToken(depositTx, { from });
          this.$parent.info(`Deposited ${value} ${tokenContract} tokens: ${tx.transactionHash}`);
        }
      } catch (err) {
        this.$parent.error(err);
      }
    }
  }
};
</script>
