const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'mockup', 'VitaminFun-Level-Mockups-standalone.html');
const content = fs.readFileSync(filePath, 'utf8');

const tagStart = '<script type="__bundler/template">';
const tagEnd = '</script>';
const idxStart = content.indexOf(tagStart);
const idxEnd = content.indexOf(tagEnd, idxStart);

if (idxStart !== -1 && idxEnd !== -1) {
  const jsonStr = content.slice(idxStart + tagStart.length, idxEnd).trim();
  const templateHtml = JSON.parse(jsonStr);
  fs.writeFileSync(path.join(__dirname, 'mockup', 'unpacked_style_reference.html'), templateHtml);
  console.log('Successfully unpacked template. Length:', templateHtml.length);
} else {
  console.log('Tags not found');
}
