<template>
  <div v-if="logs.length" class="logs">
    <div v-for="log in logs">
      <div class="log" v-bind:class="log.level">
        {{ log.message }}
        <span @click="removeLog(log)" class="remove">X</span>
      </div>
    </div>
  </div>
</template>

<script>

const MAX_LOGS = 5

export default {
  data() {
    return {
      logs: []
    };
  },
  methods: {
    log(message) {
      if (this.logs.length >= MAX_LOGS) {
        this.logs.shift()
      }
      this.logs.push(message)
    },
    info(message) {
      this.log({ message, level: 'info' })
    },
    error(message) {
      this.log({ message, level: 'error' })
    },
    removeLog(log) {
      this.logs = this.logs.filter(item => item !== log)
    }
  }
}
</script>
