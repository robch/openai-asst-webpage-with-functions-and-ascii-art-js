import { marked } from "marked"
import hljs from "highlight.js";

import { createNewChartJsChart } from './markdown-chart-helpers';
import { createNewSvgElement, createNewAsciiArtFromSvgElement } from './markdown-svg-helpers';

function markdownInit() {
  marked.setOptions({
    highlight: function (code, lang) {
      if (lang === 'chartjs') {
        let chart = createNewChartJsChart(code);
        return `<div class="chartjs">${chart}</div>`;
      } else if (lang === 'svg') {
        let svgElement = createNewSvgElement(code);
        return `<div class="svg">${svgElement}</div>`;
      } else if (lang === 'ascii-art-from-svg') {
        let asciiArtElement = createNewAsciiArtFromSvgElement(code);
        return `<div class="ascii-art-from-svg">${asciiArtElement}</div>`;
      } else {
        let hl = lang === undefined || lang === ''
          ? hljs.highlightAuto(code).value
          : hljs.highlight(lang, code).value;
        return `<div class="hljs">${hl}</div>`;
      }
    }
  });
}

function markdownToHtml(markdownText) {
  try {
    return marked.parse(markdownText);
  }
  catch (error) {
    return undefined;
  }
}

export { markdownInit, markdownToHtml };