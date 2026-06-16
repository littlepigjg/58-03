const LayoutManager = (() => {

    let mainList = null;
    let onChangeCallback = null;
    let onSelectCallback = null;
    let selectedColId = null;
    let history = null;

    function init(initialState, callbacks) {
        onChangeCallback = callbacks.onChange || (() => {});
        onSelectCallback = callbacks.onSelect || (() => {});

        mainList = BlockListManager.createManager(
            initialState.blocks || [],
            onMainListChange
        );

        selectedColId = null;

        history = HistoryManager.createManager(
            {
                getState,
                getBlockIndex,
                findBlockByIdRecursive,
                getColumnBlockIndex,
                _internalAddBlock,
                _internalAddBlockToColumn,
                _internalRemoveBlock,
                _internalRemoveBlockFromColumn,
                _internalMoveBlock,
                _internalMoveBlockInColumn,
                _internalUpdateBlock,
                _internalUpdateColumnBlock,
                _internalHandleColumnCountChange,
                _internalClearAll,
                _internalSetBlocks,
                _internalSetState
            },
            onHistoryChange
        );
    }

    function onMainListChange(blocks) {
        onChangeCallback(getState());
    }

    function onHistoryChange() {
        updateUndoRedoUI();
    }

    function getState() {
        return {
            blocks: mainList.getBlocks(),
            selectedId: mainList.getSelectedId(),
            selectedColId: selectedColId
        };
    }

    function _internalSetState(newState) {
        mainList.setBlocks(newState.blocks || []);
        mainList.setSelectedId(newState.selectedId || null);
        selectedColId = newState.selectedColId || null;
        onChangeCallback(getState());
    }

    function setState(newState) {
        const oldState = JSON.parse(JSON.stringify(getState()));
        history.setState(newState, oldState);
    }

    function selectBlock(blockId, colId) {
        mainList.setSelectedId(blockId);
        selectedColId = colId || null;
        onSelectCallback(blockId, colId);
    }

    function getSelectedInfo() {
        return {
            blockId: mainList.getSelectedId(),
            colId: selectedColId
        };
    }

    function getSelectedBlock() {
        return mainList.getSelectedBlock();
    }

    function getBlockIndex(blockId) {
        return mainList.getBlockIndex(blockId);
    }

    function _internalAddBlock(block, targetIndex) {
        mainList.addBlock(block, targetIndex);
    }

    function addBlock(block, targetIndex) {
        history.addBlock(block, targetIndex);
        selectBlock(block.id, null);
    }

    function _internalRemoveBlock(blockId) {
        mainList.removeBlock(blockId);
        if (selectedColId && !mainList.getBlockById(blockId)) {
            selectedColId = null;
        }
    }

    function removeBlock(blockId) {
        const selected = getSelectedInfo();
        if (selected.blockId === blockId) {
            selectBlock(null, null);
        }
        history.removeBlock(blockId);
    }

    function _internalMoveBlock(fromIndex, toIndex) {
        mainList.moveBlock(fromIndex, toIndex);
    }

    function moveBlock(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        history.moveBlock(fromIndex, toIndex);
    }

    function _internalUpdateBlock(blockId, data) {
        mainList.updateBlock(blockId, data);
    }

    function updateBlock(blockId, data) {
        const block = mainList.getBlockById(blockId);
        if (!block) return;
        const oldData = {};
        for (const key of Object.keys(data)) {
            oldData[key] = block.data[key];
        }
        history.updateBlock(blockId, data, oldData);
    }

    function _internalSetBlocks(newBlocks) {
        mainList.setBlocks(newBlocks);
    }

    function _internalClearAll() {
        mainList.clear();
        selectedColId = null;
        selectBlock(null, null);
    }

    function clearAll() {
        const state = getState();
        if (state.blocks.length === 0) return;
        selectBlock(null, null);
        history.clearAll();
    }

    function syncColumnBlocksToMain(blockId, colId, newColumnBlocks) {
        const currentBlocks = mainList.getBlocks();
        const newBlocks = currentBlocks.map(function(b) {
            if (b.id !== blockId) return b;
            if (b.type !== 'columns') return b;

            const newChildren = b.data.children.map(function(col) {
                if (col.id !== colId) return col;
                return { ...col, blocks: newColumnBlocks };
            });

            return {
                ...b,
                data: { ...b.data, children: newChildren }
            };
        });

        mainList.setBlocks(newBlocks);
    }

    function getColumnManager(blockId, colId) {
        const block = mainList.getBlockById(blockId);
        if (!block || block.type !== 'columns') return null;

        const col = block.data.children.find(function(c) { return c.id === colId; });
        if (!col) return null;

        const onChange = function(newColumnBlocks) {
            syncColumnBlocksToMain(blockId, colId, newColumnBlocks);
        };

        return BlockListManager.createManager(
            JSON.parse(JSON.stringify(col.blocks || [])),
            onChange
        );
    }

    function _internalAddBlockToColumn(blockId, colId, newBlock, targetIndex) {
        const colMgr = getColumnManager(blockId, colId);
        if (!colMgr) return;
        colMgr.addBlock(newBlock, targetIndex);
    }

    function addBlockToColumn(blockId, colId, newBlock, targetIndex) {
        history.addBlockToColumn(blockId, colId, newBlock, targetIndex);
        selectBlock(newBlock.id, colId);
    }

    function _internalRemoveBlockFromColumn(blockId, colId, childBlockId) {
        const colMgr = getColumnManager(blockId, colId);
        if (!colMgr) return;
        colMgr.removeBlock(childBlockId);

        const selected = getSelectedInfo();
        if (selected.blockId === childBlockId) {
            selectBlock(null, null);
        }
    }

    function removeBlockFromColumn(blockId, colId, childBlockId) {
        const selected = getSelectedInfo();
        if (selected.blockId === childBlockId) {
            selectBlock(null, null);
        }
        history.removeBlockFromColumn(blockId, colId, childBlockId);
    }

    function _internalMoveBlockInColumn(blockId, colId, fromIndex, toIndex) {
        const colMgr = getColumnManager(blockId, colId);
        if (!colMgr) return;
        colMgr.moveBlock(fromIndex, toIndex);
    }

    function moveBlockInColumn(blockId, colId, fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        history.moveBlockInColumn(blockId, colId, fromIndex, toIndex);
    }

    function _internalUpdateColumnBlock(blockId, colId, childBlockId, data) {
        const colMgr = getColumnManager(blockId, colId);
        if (!colMgr) return;
        colMgr.updateBlock(childBlockId, data);
    }

    function updateColumnBlock(blockId, colId, childBlockId, data) {
        const info = findBlockByIdRecursive(childBlockId);
        if (!info || !info.block) return;
        const oldData = {};
        for (const key of Object.keys(data)) {
            oldData[key] = info.block.data[key];
        }
        history.updateColumnBlock(blockId, colId, childBlockId, data, oldData);
    }

    function duplicateBlock(blockId) {
        const index = getBlockIndex(blockId);
        if (index === -1) return;
        const original = mainList.getBlockById(blockId);
        if (!original) return;
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        function regenerateIds(obj) {
            if (obj && typeof obj === 'object') {
                if (obj.id) {
                    obj.id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                }
                if (obj.data && obj.data.children) {
                    obj.data.children = obj.data.children.map(col => {
                        if (col.blocks) {
                            col.blocks = col.blocks.map(b => {
                                const nb = JSON.parse(JSON.stringify(b));
                                regenerateIds(nb);
                                return nb;
                            });
                        }
                        return col;
                    });
                }
            }
        }
        regenerateIds(copy);

        history.duplicateBlock(blockId, copy, index + 1);
        selectBlock(copy.id, null);
    }

    function duplicateColumnBlock(blockId, colId, childBlockId) {
        const colIndex = getColumnBlockIndex(blockId, colId, childBlockId);
        if (colIndex === -1) return;
        const info = findBlockByIdRecursive(childBlockId);
        if (!info || !info.block) return;

        const copy = JSON.parse(JSON.stringify(info.block));
        copy.id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        history.duplicateColumnBlock(blockId, colId, copy, colIndex + 1);
        selectBlock(copy.id, colId);
    }

    function getColumnBlockIndex(blockId, colId, childBlockId) {
        const colMgr = getColumnManager(blockId, colId);
        if (!colMgr) return -1;
        return colMgr.getBlockIndex(childBlockId);
    }

    function _internalHandleColumnCountChange(blockId, newCount) {
        const block = mainList.getBlockById(blockId);
        if (!block || block.type !== 'columns') return;

        const targetCount = parseInt(newCount);
        const newChildren = JSON.parse(JSON.stringify(block.data.children || []));

        while (newChildren.length < targetCount) {
            newChildren.push({
                id: 'col_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                blocks: []
            });
        }
        while (newChildren.length > targetCount) {
            newChildren.pop();
        }

        _internalUpdateBlock(blockId, { columns: targetCount, children: newChildren });
    }

    function handleColumnCountChange(blockId, newCount) {
        const block = mainList.getBlockById(blockId);
        if (!block || block.type !== 'columns') return;
        const oldChildren = JSON.parse(JSON.stringify(block.data.children || []));
        history.handleColumnCountChange(blockId, newCount, oldChildren);
    }

    function findBlockByIdRecursive(blockId) {
        let result = mainList.getBlockById(blockId);
        if (result) {
            return { block: result, parentBlockId: null, colId: null };
        }

        const blocks = mainList.getBlocks();
        for (let i = 0; i < blocks.length; i++) {
            const b = blocks[i];
            if (b.type === 'columns' && b.data.children) {
                for (let j = 0; j < b.data.children.length; j++) {
                    const col = b.data.children[j];
                    if (col.blocks) {
                        const found = col.blocks.find(function(cb) { return cb.id === blockId; });
                        if (found) {
                            return { block: found, parentBlockId: b.id, colId: col.id };
                        }
                    }
                }
            }
        }

        return null;
    }

    function updateAnyBlock(blockId, data) {
        const info = findBlockByIdRecursive(blockId);
        if (!info) return;

        if (info.parentBlockId && info.colId) {
            updateColumnBlock(info.parentBlockId, info.colId, blockId, data);
        } else {
            updateBlock(blockId, data);
        }
    }

    function deleteAnyBlock(blockId) {
        const info = findBlockByIdRecursive(blockId);
        if (!info) return;

        if (info.parentBlockId && info.colId) {
            removeBlockFromColumn(info.parentBlockId, info.colId, blockId);
        } else {
            removeBlock(blockId);
        }
    }

    function duplicateAnyBlock(blockId) {
        const info = findBlockByIdRecursive(blockId);
        if (!info) return;

        if (info.parentBlockId && info.colId) {
            duplicateColumnBlock(info.parentBlockId, info.colId, blockId);
        } else {
            duplicateBlock(blockId);
        }
    }

    function selectAnyBlock(blockId) {
        const info = findBlockByIdRecursive(blockId);
        if (!info) {
            selectBlock(null, null);
            return;
        }
        selectBlock(blockId, info.colId);
    }

    function undo() {
        return history.undo();
    }

    function redo() {
        return history.redo();
    }

    function canUndo() {
        return history.canUndo();
    }

    function canRedo() {
        return history.canRedo();
    }

    function clearHistory() {
        history.clear();
    }

    function getHistoryStatus() {
        return history.getStatus();
    }

    function updateUndoRedoUI() {
        const status = getHistoryStatus();
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');
        if (undoBtn) undoBtn.disabled = !status.canUndo;
        if (redoBtn) redoBtn.disabled = !status.canRedo;
    }

    function beginBatch() {
        history.beginBatch();
    }

    function endBatch(recordHistory = true) {
        history.endBatch(recordHistory);
    }

    function cancelBatch() {
        history.cancelBatch();
    }

    return {
        init,
        getState,
        setState,
        selectBlock,
        selectAnyBlock,
        getSelectedInfo,
        getSelectedBlock,
        getBlockIndex,
        addBlock,
        removeBlock,
        moveBlock,
        updateBlock,
        duplicateBlock,
        clearAll,
        getColumnManager,
        addBlockToColumn,
        removeBlockFromColumn,
        moveBlockInColumn,
        updateColumnBlock,
        duplicateColumnBlock,
        getColumnBlockIndex,
        handleColumnCountChange,
        findBlockByIdRecursive,
        updateAnyBlock,
        deleteAnyBlock,
        duplicateAnyBlock,
        undo,
        redo,
        canUndo,
        canRedo,
        clearHistory,
        getHistoryStatus,
        updateUndoRedoUI,
        beginBatch,
        endBatch,
        cancelBatch
    };
})();
