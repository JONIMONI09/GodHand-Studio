import { test, describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Core sorting & arrangement algorithm matching App.tsx implementation
function sortNodes(nodes, parentPath, sortMode, customOrder = {}) {
  if (!nodes || nodes.length <= 1) return nodes || [];

  if (sortMode === 'folders-first') {
    return [...nodes].sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  if (sortMode === 'name-asc') {
    return [...nodes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  if (sortMode === 'name-desc') {
    return [...nodes].sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  if (sortMode === 'type') {
    return [...nodes].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1;
      }
      const extA = a.name.includes('.') ? a.name.split('.').pop().toLowerCase() : '';
      const extB = b.name.includes('.') ? b.name.split('.').pop().toLowerCase() : '';
      if (extA !== extB) return extA.localeCompare(extB);
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  // Default 'custom' sort mode
  const orderList = customOrder[parentPath];
  if (!orderList || !Array.isArray(orderList) || orderList.length === 0) {
    return [...nodes].sort((a, b) => {
      if (a.type === 'folder' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'folder') return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  return [...nodes].sort((a, b) => {
    const idxA = orderList.indexOf(a.name);
    const idxB = orderList.indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    if (a.type === 'folder' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
}

function moveItemInList(names, nodeName, direction) {
  const index = names.indexOf(nodeName);
  if (index === -1) return names;
  const copy = [...names];
  if (direction === 'up' && index > 0) {
    const temp = copy[index];
    copy[index] = copy[index - 1];
    copy[index - 1] = temp;
  } else if (direction === 'down' && index < copy.length - 1) {
    const temp = copy[index];
    copy[index] = copy[index + 1];
    copy[index + 1] = temp;
  }
  return copy;
}

function insertItemRelative(names, movingItem, targetItem, position) {
  const filtered = names.filter(n => n !== movingItem);
  const targetIdx = filtered.indexOf(targetItem);
  if (targetIdx === -1) {
    filtered.push(movingItem);
    return filtered;
  }
  const insertIdx = position === 'before' ? Math.max(0, targetIdx) : targetIdx + 1;
  filtered.splice(insertIdx, 0, movingItem);
  return filtered;
}

describe('File Explorer Arrangement & Sorting Engine', () => {
  const sampleNodes = [
    { type: 'file', name: 'Zebra.java', path: 'src/Zebra.java' },
    { type: 'folder', name: 'src', path: 'src' },
    { type: 'file', name: 'Alpha.java', path: 'src/Alpha.java' },
    { type: 'file', name: 'config.json', path: 'config.json' },
    { type: 'file', name: 'README.md', path: 'README.md' }
  ];

  it('correctly sorts folders-first then alphabetically', () => {
    const sorted = sortNodes(sampleNodes, '', 'folders-first');
    assert.strictEqual(sorted[0].name, 'src');
    assert.strictEqual(sorted[0].type, 'folder');
    assert.strictEqual(sorted[1].name, 'Alpha.java');
    assert.strictEqual(sorted[2].name, 'config.json');
    assert.strictEqual(sorted[3].name, 'README.md');
    assert.strictEqual(sorted[4].name, 'Zebra.java');
  });

  it('sorts pure alphabetical A-Z regardless of type', () => {
    const sorted = sortNodes(sampleNodes, '', 'name-asc');
    assert.strictEqual(sorted[0].name, 'Alpha.java');
    assert.strictEqual(sorted[1].name, 'config.json');
    assert.strictEqual(sorted[2].name, 'README.md');
    assert.strictEqual(sorted[3].name, 'src');
    assert.strictEqual(sorted[4].name, 'Zebra.java');
  });

  it('sorts pure alphabetical Z-A', () => {
    const sorted = sortNodes(sampleNodes, '', 'name-desc');
    assert.strictEqual(sorted[0].name, 'Zebra.java');
    assert.strictEqual(sorted[1].name, 'src');
    assert.strictEqual(sorted[4].name, 'Alpha.java');
  });

  it('sorts by file extension / type', () => {
    const sorted = sortNodes(sampleNodes, '', 'type');
    assert.strictEqual(sorted[0].name, 'src'); // folder first
    // file extensions: .java, .json, .md
    assert.strictEqual(sorted[1].name, 'Alpha.java');
    assert.strictEqual(sorted[2].name, 'Zebra.java');
    assert.strictEqual(sorted[3].name, 'config.json');
    assert.strictEqual(sorted[4].name, 'README.md');
  });

  it('respects user custom arrangement order', () => {
    const customOrder = {
      '': ['README.md', 'Zebra.java', 'src', 'Alpha.java', 'config.json']
    };
    const sorted = sortNodes(sampleNodes, '', 'custom', customOrder);
    assert.strictEqual(sorted[0].name, 'README.md');
    assert.strictEqual(sorted[1].name, 'Zebra.java');
    assert.strictEqual(sorted[2].name, 'src');
    assert.strictEqual(sorted[3].name, 'Alpha.java');
    assert.strictEqual(sorted[4].name, 'config.json');
  });

  it('moves item up and down cleanly', () => {
    let list = ['FileA', 'FileB', 'FileC'];
    list = moveItemInList(list, 'FileC', 'up');
    assert.deepStrictEqual(list, ['FileA', 'FileC', 'FileB']);

    list = moveItemInList(list, 'FileA', 'down');
    assert.deepStrictEqual(list, ['FileC', 'FileA', 'FileB']);

    // Moving top item up should be a no-op
    list = moveItemInList(list, 'FileC', 'up');
    assert.deepStrictEqual(list, ['FileC', 'FileA', 'FileB']);
  });

  it('inserts item before or after target for drag-and-drop', () => {
    let list = ['File1', 'File2', 'File3'];
    // Move File3 before File1
    list = insertItemRelative(list, 'File3', 'File1', 'before');
    assert.deepStrictEqual(list, ['File3', 'File1', 'File2']);

    // Move File1 after File3
    list = insertItemRelative(list, 'File2', 'File3', 'before');
    assert.deepStrictEqual(list, ['File2', 'File3', 'File1']);
  });

  it('gracefully handles empty list, null, and non-existent nodes', () => {
    assert.deepStrictEqual(sortNodes([], '', 'custom'), []);
    assert.deepStrictEqual(sortNodes(null, '', 'custom'), []);
    assert.deepStrictEqual(moveItemInList(['A'], 'NonExistent', 'up'), ['A']);
  });
});
