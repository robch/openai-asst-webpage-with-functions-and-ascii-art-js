let totalSVGs = 0;
let svgsNotPopulated = [];

let totalAsciiArtFromSvg = 0;
let asciiArtFromSvgNotPopulated = [];

function populateNewSvgLater(svgId, svgCode) {
  svgsNotPopulated.push({ id: svgId, code: svgCode });
}

function populateNewSvgNow(svgItem) {
  let elem = document.getElementById(svgItem.id);
  if (elem) {
    elem.innerHTML = svgItem.code;
  }
}

function populateNewSvgsNow() {
  svgsNotPopulated.forEach(svg => {
    populateNewSvgNow(svg);
  });
  svgsNotPopulated = [];
}

function createNewSvgElement(code) {
  const svgId = `svg-${totalSVGs}`;
  const html = `<div id="${svgId}"></div>`;
  populateNewSvgLater(svgId, code);
  totalSVGs++;
  return html;
}

function populateNewAsciiArtFromSvgLater(id, code) {
  asciiArtFromSvgNotPopulated.push({ id: id, svgCode: code });
}

async function populateNewAsciiArtFromSvgNow() {
  for (let item of asciiArtFromSvgNotPopulated) {
    await populateNewAsciiArtFromSvgNowItem(item);
  }
  asciiArtFromSvgNotPopulated = [];
}

async function populateNewAsciiArtFromSvgNowItem(item) {
  const finalCanvas = document.getElementById(item.id);
  if (!finalCanvas) {
    console.warn(`[ASCII-ART] No finalCanvas found for id: ${item.id}`);
    return;
  }

  const svgElement = finalCanvas.parentElement.querySelector('svg');
  if (!svgElement) {
    console.error(`[ASCII-ART] No <svg> element found in provided code for id: ${item.id}`);
    return;
  }

  try {
    const imageData = await getImageDataFromSvg(svgElement);
    const asciiLines = renderAsciiArt(imageData, finalCanvas);
    initCopyOnClick(finalCanvas, asciiLines);
  } catch (error) {
    console.error(`[ASCII-ART] Error during ASCII conversion: ${error}`);
  }
}

function getImageDataFromSvg(svgElement) {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.src = svgUrl;

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      
      if (!width || !height) {
        URL.revokeObjectURL(svgUrl);
        reject("Image width/height is zero or undefined");
        return;
      }

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = width;
      tmpCanvas.height = height;
      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.drawImage(img, 0, 0);

      const imageData = tmpCtx.getImageData(0, 0, tmpCanvas.width, tmpCanvas.height);
      URL.revokeObjectURL(svgUrl);
      resolve(imageData);
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(svgUrl);
      reject(`Failed to load image: ${err.message}`);
    };
  });
}

function renderAsciiArt(imageData, finalCanvas) {
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const asciiMap = " .:-=+*#%@";
  const charsPerRow = width;
  const rows = height;

  const finalCtx = finalCanvas.getContext('2d');
  finalCtx.font = "10px 'Courier New', monospace";

  const metrics = finalCtx.measureText("M");
  const charWidth = metrics.width;
  const charHeight = (metrics.actualBoundingBoxAscent && metrics.actualBoundingBoxDescent) 
    ? (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) 
    : 10;

  const charDim = Math.max(charWidth, charHeight);

  const scale = 700 / width / charDim;
  const sampleW = Math.max(1, Math.floor(charsPerRow * scale));
  const sampleH = Math.max(1, Math.floor(rows * scale));

  let asciiLines = [];
  for (let y = 0; y < sampleH; y++) {
    let line = "";
    for (let x = 0; x < sampleW; x++) {
      let srcX = Math.floor(x / scale);
      let srcY = Math.floor(y / scale);
      let idx = (srcY * charsPerRow + srcX) * 4;
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      if (r === undefined || g === undefined || b === undefined) {
        line += " ";
        continue;
      }

      let gray = (r + g + b) / 3;
      let charIndex = Math.floor((gray / 255) * (asciiMap.length - 1));
      let char = asciiMap.charAt(charIndex);
      line += char;
    }
    asciiLines.push(line);
  }

  finalCanvas.width = Math.ceil(sampleW * charDim);
  finalCanvas.height = Math.ceil(sampleH * charDim);

  finalCtx.fillStyle = "#000";
  finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  finalCtx.fillStyle = "#FFF";
  for (let i = 0; i < asciiLines.length; i++) {
    for (let j = 0; j < asciiLines[i].length; j++) {
      finalCtx.fillText(asciiLines[i][j], j * charDim, i * charDim + charDim);
    }
  }

  return asciiLines;
}

function initCopyOnClick(finalCanvas, asciiLines) {
  finalCanvas.dataset.ascii = asciiLines.join('\n');
  finalCanvas.onclick = (event) => {
    const ascii = finalCanvas.dataset.ascii;
    navigator.clipboard.writeText(ascii);
    setTimeout(() => {
      alert("ASCII art copied to clipboard!");
    }, 50);
  };

  finalCanvas.title = "Click to copy ASCII art to clipboard";
}

function createNewAsciiArtFromSvgElement(code) {
  const asciiArtId = `ascii-art-${totalAsciiArtFromSvg}`;
  const svgId = `svg-${totalSVGs}`;
  const html = `
      <div id="${svgId}" class="svg"></div>
      <canvas id="${asciiArtId}" class="ascii-art"></canvas>
  `;
  populateNewSvgLater(svgId, code);
  populateNewAsciiArtFromSvgLater(asciiArtId, code);
  totalSVGs++;
  totalAsciiArtFromSvg++;
  return html;
}

export {
  populateNewSvgsNow,
  createNewSvgElement,
  populateNewAsciiArtFromSvgNow,
  createNewAsciiArtFromSvgElement
};
