let maxBlockSize = 1 * 1024 * 1024; //Each file will be split in 4 MB.
let numberOfBlocks = 1;
let selectedFile = null;
var currentFilePointer = 0;
var totalBytesRemaining = 0;
var blockIds = [];
const blockIdPrefix = "block-";
var submitUri = null;
var bytesUploaded = 0;
let timeStarted;
let outputEl, fileEl, fileNameEl, fileSizeEl, fileTypeEl, sasURLEl, fileUploadProgressEl, fileUploadRemainingTimeEl;
let videoURL ='';
var sizes = [
  'Bytes', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB'
];

document.addEventListener('DOMContentLoaded', (event) => {
  outputEl = document.querySelector('#output');
  fileEl = document.querySelector('#file');
  fileNameEl = document.querySelector('#fileName');
  fileSizeEl = document.querySelector('#fileSize');
  fileTypeEl = document.querySelector('#fileType');
  sasURLEl = document.querySelector('#sasUrl');
  fileUploadProgressEl = document.querySelector('#fileUploadProgress');
  fileUploadRemainingTimeEl = document.querySelector('#fileUploadRemainingTime');
  outputEl.style.display = 'none'
  fileEl.addEventListener('change', handleFileSelect);
});

//Read the file and find out how many blocks we would need to split it.
function handleFileSelect(e) {
  timeStarted = null;
  blockIds = [];
  maxBlockSize = 4 * 1024 * 1024;
  currentFilePointer = 0;
  bytesUploaded = 0;
  totalBytesRemaining = 0;
  var files = e.target.files;
  selectedFile = files[0];
  outputEl.style.display = 'block';
  fileNameEl.textContent = selectedFile.name;
  fileSizeEl.textContent = formatBytes(selectedFile.size);
  console.log("Total File Size: ", selectedFile.size, "Bytes")
  fileTypeEl.textContent = selectedFile.type;
  var fileSize = selectedFile.size;
  if (fileSize < maxBlockSize) {
    maxBlockSize = fileSize;
    console.log("max block size = " + maxBlockSize);
  }
  totalBytesRemaining = fileSize;
  if (fileSize % maxBlockSize == 0) {
    numberOfBlocks = fileSize / maxBlockSize;
  } else {
    numberOfBlocks = parseInt(fileSize / maxBlockSize, 10) + 1;
  }
  console.log("total blocks = " + numberOfBlocks);
  var baseUrl = sasURLEl.value;
  var indexOfQueryStart = baseUrl.indexOf("?");
  submitUri = baseUrl.substring(0, indexOfQueryStart) + baseUrl.substring(indexOfQueryStart);
  console.log(submitUri);
}

var reader = new FileReader();

reader.onloadend = function (evt) {
  if (evt.target.readyState == FileReader.DONE) { // DONE == 2
    var uri = submitUri + '&comp=block&blockid=' + blockIds[blockIds.length - 1];
    var requestData = new Uint8Array(evt.target.result);
    const fetchPromise = fetch(uri, {
      "headers": {
        "Content-Type": "video/mp4",
        "Content-Length": requestData.length,
        "x-ms-blob-type": "BlockBlob"
      },
      "body": requestData,
      "method": "PUT",
    });
    fetchPromise.then((value) => {
      bytesUploaded += requestData.length;
      var percentComplete = ((parseFloat(bytesUploaded) / parseFloat(selectedFile.size)) * 100).toFixed(2);
      fileUploadProgressEl.textContent = percentComplete + " %";
      fileUploadingTimeCalculation();
      uploadFileInBlocks();
    })
  }
};

function fileUploadingTimeCalculation() {
  let timeElapsed = (new Date()) - timeStarted; // Assuming that timeStarted is a Date Object
  let uploadSpeed = Math.floor(bytesUploaded / (timeElapsed/1000)); // Upload speed in second
  let estimatedSecondsLeft = Math.round(((selectedFile.size - bytesUploaded) / uploadSpeed));
  if(!estimatedSecondsLeft) { return; }
  // The only argument is the number of remaining seconds. 
  // fileUploadRemainingTimeEl.textContent = estimatedSecondsLeft + " Seconds";
  countdownTimer(estimatedSecondsLeft,'seconds');
}

function countdownTimer(number, unit) {
  let m,s,h,d;
  if (isNaN(number)) {
    throw new TypeError('Value must be a number.')
  }

  if (unit === 'sec' || unit === 'seconds') {
    s = number
  } else if (unit === 'ms' || unit === 'milliseconds' || !unit) {
    s = Math.floor(number / 1000)
  } else {
    throw new TypeError('Unit must be sec or ms');
  }

  m = Math.floor(s / 60);
  s = s % 60;
  h = Math.floor(m / 60);
  m = m % 60;
  d = Math.floor(h / 24);
  h = h % 24;

  let parts = {days: d, hours: h, minutes: m, seconds: s};
  let remaining = Object.keys(parts)
    .map(part => {
      if (!parts[part]) return;
      return `${parts[part]} ${part}`;
    })
    .join(" ");
  fileUploadRemainingTimeEl.textContent = remaining;
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) { return '0 Bytes'; }
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function uploadFileInBlocks() {
  if(!timeStarted) { timeStarted = new Date(); }
  if (totalBytesRemaining > 0) {
    console.log("current file pointer = " + currentFilePointer + " bytes read = " + maxBlockSize);
    var fileContent = selectedFile.slice(currentFilePointer, currentFilePointer + maxBlockSize);
    var blockId = blockIdPrefix + pad(blockIds.length, 6);
    console.log("block id = " + blockId);
    blockIds.push(btoa(blockId));
    reader.readAsArrayBuffer(fileContent);
    currentFilePointer += maxBlockSize;
    totalBytesRemaining -= maxBlockSize;
    if (totalBytesRemaining < maxBlockSize) {
      maxBlockSize = totalBytesRemaining;
    }
  } else {
    setTimeout(() => {
      commitBlockList();
    }, 4000)
  }
}

function commitBlockList() {
  var uri = submitUri + '&comp=blocklist';
  console.log(uri);
  var requestBody = '<?xml version="1.0" encoding="utf-8"?><BlockList>';
  for (var i = 0; i < blockIds.length; i++) {
    requestBody += '<Latest>' + blockIds[i] + '</Latest>';
  }
  requestBody += '</BlockList>';
  console.log(requestBody);
  const blockListPromise = fetch(uri, {
    "headers": {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "x-ms-blob-content-type": selectedFile.type
    },
    "body": requestBody,
    "method": "PUT",
  });
  blockListPromise.then((value) => {
    console.log(value)
    videoURL  = sasURLEl.value.split(/[?#]/)[0];
    console.log('success')
    document.querySelector('#finalVideo').src = videoURL
  }).catch(error => console.log(error));


}

function pad(number, length) {
  var str = '' + number;
  while (str.length < length) {
    str = '0' + str;
  }
  return str;
}
