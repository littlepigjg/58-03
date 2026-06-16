const HistoryManager = (() => {

    const MAX_HISTORY = 20;

    class Command {
        execute() {}
        undo() {}
    }

    class AddBlockCommand extends Command {
        constructor(layoutManager, block, targetIndex) {
            super();
            this.layoutManager = layoutManager;
            this.block = block;
            this.targetIndex = targetIndex;
            this.addedIndex = -1;
        }

        execute() {
            this.layoutManager._internalAddBlock(this.block, this.targetIndex);
            this.addedIndex = this.layoutManager.getBlockIndex(this.block.id);
        }

        undo() {
            if (this.addedIndex >= 0) {
                this.layoutManager._internalRemoveBlock(this.block.id);
            }
        }
    }

    class AddBlockToColumnCommand extends Command {
        constructor(layoutManager, parentBlockId, colId, block, targetIndex) {
            super();
            this.layoutManager = layoutManager;
            this.parentBlockId = parentBlockId;
            this.colId = colId;
            this.block = block;
            this.targetIndex = targetIndex;
        }

        execute() {
            this.layoutManager._internalAddBlockToColumn(this.parentBlockId, this.colId, this.block, this.targetIndex);
        }

        undo() {
            this.layoutManager._internalRemoveBlockFromColumn(this.parentBlockId, this.colId, this.block.id);
        }
    }

    class RemoveBlockCommand extends Command {
        constructor(layoutManager, blockId) {
            super();
            this.layoutManager = layoutManager;
            this.blockId = blockId;
            this.removedBlock = null;
            this.removedIndex = -1;
        }

        execute() {
            const state = this.layoutManager.getState();
            this.removedIndex = state.blocks.findIndex(b => b.id === this.blockId);
            if (this.removedIndex >= 0) {
                this.removedBlock = JSON.parse(JSON.stringify(state.blocks[this.removedIndex]));
                this.layoutManager._internalRemoveBlock(this.blockId);
            }
        }

        undo() {
            if (this.removedBlock && this.removedIndex >= 0) {
                this.layoutManager._internalAddBlock(this.removedBlock, this.removedIndex);
            }
        }
    }

    class RemoveBlockFromColumnCommand extends Command {
        constructor(layoutManager, parentBlockId, colId, blockId) {
            super();
            this.layoutManager = layoutManager;
            this.parentBlockId = parentBlockId;
            this.colId = colId;
            this.blockId = blockId;
            this.removedBlock = null;
            this.removedIndex = -1;
        }

        execute() {
            const info = this.layoutManager.findBlockByIdRecursive(this.blockId);
            if (info && info.parentBlockId === this.parentBlockId && info.colId === this.colId) {
                this.removedBlock = JSON.parse(JSON.stringify(info.block));
                this.removedIndex = this.layoutManager.getColumnBlockIndex(this.parentBlockId, this.colId, this.blockId);
                this.layoutManager._internalRemoveBlockFromColumn(this.parentBlockId, this.colId, this.blockId);
            }
        }

        undo() {
            if (this.removedBlock && this.removedIndex >= 0) {
                this.layoutManager._internalAddBlockToColumn(this.parentBlockId, this.colId, this.removedBlock, this.removedIndex);
            }
        }
    }

    class MoveBlockCommand extends Command {
        constructor(layoutManager, fromIndex, toIndex) {
            super();
            this.layoutManager = layoutManager;
            this.fromIndex = fromIndex;
            this.toIndex = toIndex;
            this.blockId = null;
            this.actualToIndex = -1;
        }

        execute() {
            const state = this.layoutManager.getState();
            this.blockId = state.blocks[this.fromIndex].id;
            this.layoutManager._internalMoveBlock(this.fromIndex, this.toIndex);
            this.actualToIndex = this.layoutManager.getBlockIndex(this.blockId);
        }

        undo() {
            const currentIndex = this.layoutManager.getBlockIndex(this.blockId);
            if (currentIndex >= 0 && currentIndex !== this.fromIndex) {
                this.layoutManager._internalMoveBlock(currentIndex, this.fromIndex);
            }
        }
    }

    class MoveBlockInColumnCommand extends Command {
        constructor(layoutManager, parentBlockId, colId, fromIndex, toIndex) {
            super();
            this.layoutManager = layoutManager;
            this.parentBlockId = parentBlockId;
            this.colId = colId;
            this.fromIndex = fromIndex;
            this.toIndex = toIndex;
            this.blockId = null;
        }

        execute() {
            const state = this.layoutManager.getState();
            const parentBlock = state.blocks.find(b => b.id === this.parentBlockId);
            if (parentBlock && parentBlock.data && parentBlock.data.children) {
                const col = parentBlock.data.children.find(c => c.id === this.colId);
                if (col && col.blocks && col.blocks[this.fromIndex]) {
                    this.blockId = col.blocks[this.fromIndex].id;
                }
            }
            this.layoutManager._internalMoveBlockInColumn(this.parentBlockId, this.colId, this.fromIndex, this.toIndex);
        }

        undo() {
            if (!this.blockId) return;
            const currentIndex = this.layoutManager.getColumnBlockIndex(this.parentBlockId, this.colId, this.blockId);
            if (currentIndex >= 0 && currentIndex !== this.fromIndex) {
                this.layoutManager._internalMoveBlockInColumn(this.parentBlockId, this.colId, currentIndex, this.fromIndex);
            }
        }
    }

    class UpdateBlockCommand extends Command {
        constructor(layoutManager, blockId, newData, oldData) {
            super();
            this.layoutManager = layoutManager;
            this.blockId = blockId;
            this.newData = newData;
            this.oldData = oldData;
        }

        execute() {
            this.layoutManager._internalUpdateBlock(this.blockId, this.newData);
        }

        undo() {
            this.layoutManager._internalUpdateBlock(this.blockId, this.oldData);
        }
    }

    class UpdateColumnBlockCommand extends Command {
        constructor(layoutManager, parentBlockId, colId, blockId, newData, oldData) {
            super();
            this.layoutManager = layoutManager;
            this.parentBlockId = parentBlockId;
            this.colId = colId;
            this.blockId = blockId;
            this.newData = newData;
            this.oldData = oldData;
        }

        execute() {
            this.layoutManager._internalUpdateColumnBlock(this.parentBlockId, this.colId, this.blockId, this.newData);
        }

        undo() {
            this.layoutManager._internalUpdateColumnBlock(this.parentBlockId, this.colId, this.blockId, this.oldData);
        }
    }

    class DuplicateBlockCommand extends Command {
        constructor(layoutManager, blockId, newBlock, insertIndex) {
            super();
            this.layoutManager = layoutManager;
            this.blockId = blockId;
            this.newBlock = newBlock;
            this.insertIndex = insertIndex;
        }

        execute() {
            this.layoutManager._internalAddBlock(this.newBlock, this.insertIndex);
        }

        undo() {
            this.layoutManager._internalRemoveBlock(this.newBlock.id);
        }
    }

    class DuplicateColumnBlockCommand extends Command {
        constructor(layoutManager, parentBlockId, colId, newBlock, insertIndex) {
            super();
            this.layoutManager = layoutManager;
            this.parentBlockId = parentBlockId;
            this.colId = colId;
            this.newBlock = newBlock;
            this.insertIndex = insertIndex;
        }

        execute() {
            this.layoutManager._internalAddBlockToColumn(this.parentBlockId, this.colId, this.newBlock, this.insertIndex);
        }

        undo() {
            this.layoutManager._internalRemoveBlockFromColumn(this.parentBlockId, this.colId, this.newBlock.id);
        }
    }

    class HandleColumnCountChangeCommand extends Command {
        constructor(layoutManager, blockId, newCount, oldChildren) {
            super();
            this.layoutManager = layoutManager;
            this.blockId = blockId;
            this.newCount = newCount;
            this.oldChildren = oldChildren;
        }

        execute() {
            this.layoutManager._internalHandleColumnCountChange(this.blockId, this.newCount);
        }

        undo() {
            this.layoutManager._internalUpdateBlock(this.blockId, {
                columns: this.oldChildren.length,
                children: this.oldChildren
            });
        }
    }

    class ClearAllCommand extends Command {
        constructor(layoutManager) {
            super();
            this.layoutManager = layoutManager;
            this.oldBlocks = null;
        }

        execute() {
            const state = this.layoutManager.getState();
            this.oldBlocks = JSON.parse(JSON.stringify(state.blocks));
            this.layoutManager._internalClearAll();
        }

        undo() {
            if (this.oldBlocks) {
                this.layoutManager._internalSetBlocks(this.oldBlocks);
            }
        }
    }

    class SetStateCommand extends Command {
        constructor(layoutManager, newState, oldState) {
            super();
            this.layoutManager = layoutManager;
            this.newState = newState;
            this.oldState = oldState;
        }

        execute() {
            this.layoutManager._internalSetState(this.newState);
        }

        undo() {
            this.layoutManager._internalSetState(this.oldState);
        }
    }

    class RingBuffer {
        constructor(maxSize) {
            this.maxSize = maxSize;
            this.buffer = [];
            this.start = 0;
            this.count = 0;
        }

        push(item) {
            if (this.count < this.maxSize) {
                this.buffer.push(item);
                this.count++;
            } else {
                this.buffer[this.start] = item;
                this.start = (this.start + 1) % this.maxSize;
            }
        }

        get(index) {
            if (index < 0 || index >= this.count) return null;
            const actualIndex = (this.start + index) % this.maxSize;
            return this.buffer[actualIndex];
        }

        set(index, item) {
            if (index < 0 || index >= this.count) return;
            const actualIndex = (this.start + index) % this.maxSize;
            this.buffer[actualIndex] = item;
        }

        pop() {
            if (this.count === 0) return null;
            this.count--;
            const actualIndex = (this.start + this.count) % this.maxSize;
            return this.buffer[actualIndex];
        }

        truncate(fromIndex) {
            if (fromIndex < 0 || fromIndex >= this.count) return;
            this.count = fromIndex;
        }

        getCount() {
            return this.count;
        }

        clear() {
            this.buffer = [];
            this.start = 0;
            this.count = 0;
        }
    }

    function createManager(layoutManager, onChange) {
        const history = new RingBuffer(MAX_HISTORY);
        let currentIndex = -1;
        let isPerformingUndoRedo = false;
        let isBatching = false;
        let batchCommands = [];

        function executeCommand(command, recordHistory = true) {
            if (isBatching) {
                batchCommands.push(command);
                command.execute();
                return;
            }

            command.execute();

            if (recordHistory) {
                history.truncate(currentIndex + 1);
                history.push(command);
                currentIndex = history.getCount() - 1;
            }

            if (onChange) onChange();
        }

        function undo() {
            if (currentIndex < 0) return false;

            isPerformingUndoRedo = true;
            try {
                const command = history.get(currentIndex);
                if (command) {
                    command.undo();
                    currentIndex--;
                    if (onChange) onChange();
                    return true;
                }
            } finally {
                isPerformingUndoRedo = false;
            }
            return false;
        }

        function redo() {
            if (currentIndex >= history.getCount() - 1) return false;

            isPerformingUndoRedo = true;
            try {
                const command = history.get(currentIndex + 1);
                if (command) {
                    command.execute();
                    currentIndex++;
                    if (onChange) onChange();
                    return true;
                }
            } finally {
                isPerformingUndoRedo = false;
            }
            return false;
        }

        function canUndo() {
            return currentIndex >= 0;
        }

        function canRedo() {
            return currentIndex < history.getCount() - 1;
        }

        function beginBatch() {
            isBatching = true;
            batchCommands = [];
        }

        function endBatch(recordHistory = true) {
            isBatching = false;
            const commands = batchCommands;
            batchCommands = [];

            if (commands.length === 0) return;

            if (commands.length === 1) {
                if (recordHistory) {
                    history.truncate(currentIndex + 1);
                    history.push(commands[0]);
                    currentIndex = history.getCount() - 1;
                }
                return;
            }

            const batchCommand = {
                execute: () => commands.forEach(cmd => cmd.execute()),
                undo: () => {
                    for (let i = commands.length - 1; i >= 0; i--) {
                        commands[i].undo();
                    }
                }
            };

            if (recordHistory) {
                history.truncate(currentIndex + 1);
                history.push(batchCommand);
                currentIndex = history.getCount() - 1;
            }
        }

        function cancelBatch() {
            isBatching = false;
            batchCommands = [];
        }

        function clear() {
            history.clear();
            currentIndex = -1;
            if (onChange) onChange();
        }

        function addBlock(block, targetIndex) {
            const cmd = new AddBlockCommand(layoutManager, block, targetIndex);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function addBlockToColumn(parentBlockId, colId, block, targetIndex) {
            const cmd = new AddBlockToColumnCommand(layoutManager, parentBlockId, colId, block, targetIndex);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function removeBlock(blockId) {
            const cmd = new RemoveBlockCommand(layoutManager, blockId);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function removeBlockFromColumn(parentBlockId, colId, blockId) {
            const cmd = new RemoveBlockFromColumnCommand(layoutManager, parentBlockId, colId, blockId);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function moveBlock(fromIndex, toIndex) {
            const cmd = new MoveBlockCommand(layoutManager, fromIndex, toIndex);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function moveBlockInColumn(parentBlockId, colId, fromIndex, toIndex) {
            const cmd = new MoveBlockInColumnCommand(layoutManager, parentBlockId, colId, fromIndex, toIndex);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function updateBlock(blockId, newData, oldData) {
            const cmd = new UpdateBlockCommand(layoutManager, blockId, newData, oldData);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function updateColumnBlock(parentBlockId, colId, blockId, newData, oldData) {
            const cmd = new UpdateColumnBlockCommand(layoutManager, parentBlockId, colId, blockId, newData, oldData);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function duplicateBlock(blockId, newBlock, insertIndex) {
            const cmd = new DuplicateBlockCommand(layoutManager, blockId, newBlock, insertIndex);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function duplicateColumnBlock(parentBlockId, colId, newBlock, insertIndex) {
            const cmd = new DuplicateColumnBlockCommand(layoutManager, parentBlockId, colId, newBlock, insertIndex);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function handleColumnCountChange(blockId, newCount, oldChildren) {
            const cmd = new HandleColumnCountChangeCommand(layoutManager, blockId, newCount, oldChildren);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function clearAll() {
            const cmd = new ClearAllCommand(layoutManager);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function setState(newState, oldState) {
            const cmd = new SetStateCommand(layoutManager, newState, oldState);
            executeCommand(cmd, !isPerformingUndoRedo);
        }

        function getStatus() {
            return {
                canUndo: canUndo(),
                canRedo: canRedo(),
                historySize: history.getCount(),
                currentIndex: currentIndex
            };
        }

        return {
            addBlock,
            addBlockToColumn,
            removeBlock,
            removeBlockFromColumn,
            moveBlock,
            moveBlockInColumn,
            updateBlock,
            updateColumnBlock,
            duplicateBlock,
            duplicateColumnBlock,
            handleColumnCountChange,
            clearAll,
            setState,
            undo,
            redo,
            canUndo,
            canRedo,
            beginBatch,
            endBatch,
            cancelBatch,
            clear,
            getStatus
        };
    }

    return {
        createManager,
        MAX_HISTORY
    };
})();
