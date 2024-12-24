let totalCharts = 0;
let chartsNotPopulated = [];

function populateNewChartLater(chartId, chartConfig) {
  chartsNotPopulated.push({ id: chartId, config: chartConfig });
}

function populateNewChartNow(chart) {
    let ctx = document.getElementById(chart.id).getContext('2d');
    new Chart(ctx, {
      type: chart.config.type,
      data: chart.config.data,
      options: chart.config.options
    });
}

function populateNewChartsNow() {
  chartsNotPopulated.forEach(chart => {
    populateNewChartNow(chart);
  });
  chartsNotPopulated = [];
}

function createNewChartJsChart(code) {

  const chartId = `chart-${totalCharts}`;
  const html = `<canvas id="${chartId}"></canvas>`;

  let chartConfig;
  try {
    chartConfig = JSON.parse(code);
  } catch (e) {
    return html;
  }

  populateNewChartLater(chartId, chartConfig);
  totalCharts++;

  return html;
}

export { createNewChartJsChart, populateNewChartsNow };
