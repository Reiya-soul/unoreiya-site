document.getElementById('generateBtn').addEventListener('click', function() {
  const id = document.getElementById('id').value.trim();
  const name = document.getElementById('name').value.trim();
  const effectName = document.getElementById('effectName').value.trim();
  const effectFull = document.getElementById('effectFull').value.trim();
  const series = document.getElementById('series').value.trim();
  const category = document.getElementById('category').value.trim();
  const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
  const keywords = document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k);
  const type = document.getElementById('type').value.trim();
  const image = document.getElementById('image').value.trim();
  const effectShort = effectFull.length > 40 ? effectFull.substring(0, 40) + '...' : effectFull;

  const card = {
    id: id,
    name: name,
    effectName: effectName,
    effectFull: effectFull,
    effectShort: effectShort,
    series: series,
    category: category,
    tags: tags,
    keywords: keywords,
    type: type,
    image: image
  };

  const output = JSON.stringify(card, null, 2);
  document.getElementById('output').value = output;
});

document.getElementById('copyBtn').addEventListener('click', function() {
  const output = document.getElementById('output');
  output.select();
  document.execCommand('copy');
  alert('コピーしました！');
});