<template>
  <div ref="chartContainer" class="tradingview-chart"></div>
</template>

<script>
import { widget } from '../../public/charting_library';
import BinanceDataFeed from '../services/datafeed';

export default {
  props: {
    symbol: {
      type: String,
      default: 'BTCUSDT'
    },
    interval: {
      type: String,
      default: '1D'
    }
  },
  mounted() {
    this.initChart();
  },
  methods: {
    async initChart() {
      new widget({
        container: this.$refs.chartContainer,
        symbol: this.symbol,
        interval: this.interval,
        timezone: 'Asia/Shanghai',
          library_path: '/charting_library/',
          datafeed: new BinanceDataFeed(),
          theme: 'dark',
          locale: "zh",
          fullscreen: true,
          favorites: {
              intervals: ['1', '3', '5', '15', '30', '1h', '2h', '4h', '6h', '8h', '12h', "1D", "W"],
          },
          disabled_features: ["header_compare", "header_saveload", "study_templates"],
          autosize: true,
        // studies: [
        //   'Volume@tv-basicstudies'
        // ],
        // toolbar_bg: '#1a1a1a',
        // enabled_features: ['header_fullscreen_button'],
      });
    }
  }
}
</script>

<style scoped>
.tradingview-chart {
  height: 600px;
  width: 100%;
}
</style>
