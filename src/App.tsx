import React, { FC, ReactNode, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import fs from "fs";
import path from "path";
import { outputXml } from "./utils/generateOutput";
import clipboard from "clipboardy";

const COLORS = {
    default: "lightGray",
    selected: "yellow",
    current: "blue",
    folder: "cyan",
    file: "green",
    search: "magenta",
    info: "gray"
  };

const ICONS = {
    FOLDER_CLOSED: "📪",
    FOLDER_OPEN: "📬",
    FILE: "📄",
    SELECTED: "☑︎",
    NOT_SELECTED: "☐",
};

interface Item {
    id: string;
    name: string;
    isDirectory: boolean;
    children: Item[];
    path: string;
    isExpanded: boolean;
    level: number;
}

const generateId = (itemPath: string): string => {
    return itemPath;
};

const App: FC = () => {
    const [excludedFolders] = useState<string[]>([
        "node_modules",
        ".git",
        "dist",
        "build",
        "coverage",
        "public",
    ]);
    const [currentItemId, setCurrentItemId] = useState<string | null>(null);
    const [items, setItems] = useState<Item[]>([]);
    const [selectedItems, setSelectedItems] = useState<Item[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [message, setMessage] = useState<ReactNode | null>(null);

    useInput((input, key) => {
        if (key.return) {
            copyContentsOfFilesAndFolders();
            return;
        }
        if (key.downArrow) {
            navigateToNextItem();
            return;
        }
        if (key.upArrow) {
            navigateToPreviousItem();
            return;
        }
        if (key.leftArrow || key.rightArrow) {
            toggleFolderExpansion();
            return;
        }
        if (input === " ") {
            toggleSelection();
            return;
        }
        if (key.backspace || key.delete) {
            setSearchQuery((prev) => prev.slice(0, -1));
            return;
        }
        // Only add to search query if it's a regular input (not a special key)
        if (input && !key.ctrl && !key.meta && !key.shift) {
            setSearchQuery((prev) => prev + input);
        }
    });

    const copyContentsOfFilesAndFolders = () => {
        const files = outputXml(selectedItems);
        clipboard.writeSync(files.content);
        setMessage(
            <Text color="white">
                💾 Successfully copied <Text color="cyan">{files.fileCount}</Text> file
                {files.fileCount > 1 && "s"} to clipboard
            </Text>
        );
        setTimeout(() => {
            process.exit(0);
        }, 300);
    };

    const toggleSelection = () => {
        if (!currentItemId) {
            return;
        }

        const currentItem = findItemById(currentItemId, items);
        if (!currentItem) {
            return;
        }

        if (currentItem.isDirectory) {
            const itemsInFolder = getItemsFromFolder(currentItem);
            const allItemsInFolderAreSelected = itemsInFolder.every((item) =>
                selectedItems.includes(item)
            );
            if (allItemsInFolderAreSelected) {
                setSelectedItems(
                    selectedItems.filter(
                        (item) => !itemsInFolder.find((i) => i.id === item.id)
                    )
                );
            } else {
                const newSelectedItems = selectedItems.filter(
                    (item) => !itemsInFolder.find((i) => i.id === item.id)
                );
                setSelectedItems([...newSelectedItems, ...itemsInFolder]);
            }
        } else {
            if (selectedItems.find((item) => item.id === currentItem.id)) {
                setSelectedItems(
                    selectedItems.filter((item) => item.id !== currentItem.id)
                );
            } else {
                setSelectedItems([...selectedItems, currentItem]);
            }
        }
    };

    const getItemsFromFolder = (folder: Item): Item[] => {
        const items: Item[] = [];
        const traverseItems = (item: Item) => {
            items.push(item);
            if (item.isDirectory) {
                item.children.forEach(traverseItems);
            }
        };
        traverseItems(folder);
        return items;
    };

    const loadFilesAndFolders = (dirPath: string, level: number = 0): Item[] => {
        const items: Item[] = [];
        const dirItems = fs.readdirSync(dirPath);
        const sortedItems = dirItems.sort((a, b) => {
            const aIsDir = fs.statSync(path.join(dirPath, a)).isDirectory();
            const bIsDir = fs.statSync(path.join(dirPath, b)).isDirectory();
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        });

        for (const item of sortedItems) {
            const itemPath = path.join(dirPath, item);
            const isDirectory = fs.statSync(itemPath).isDirectory();
            const id = generateId(itemPath);

            if (!excludedFolders.includes(item)) {
                const newItem: Item = {
                    id,
                    name: item,
                    isDirectory,
                    children: [],
                    path: itemPath,
                    isExpanded: false,
                    level,
                };

                if (isDirectory) {
                    newItem.children = loadFilesAndFolders(itemPath, level + 1);
                }

                items.push(newItem);
            }
        }

        return items;
    };

    useEffect(() => {
        const items = loadFilesAndFolders(process.cwd());
        setItems(items);
        setCurrentItemId(items[0]?.id || null);
    }, []);

    const findItemByIdInFilteredItems = (
        itemId: string,
        items: Item[]
    ): Item | undefined => {
        for (const item of items) {
            if (item.id === itemId) {
                return item;
            }
            if (item.isDirectory && item.isExpanded) {
                const foundItem = findItemByIdInFilteredItems(itemId, item.children);
                if (foundItem) {
                    return foundItem;
                }
            }
        }
        return undefined;
    };

    const findItemById = (itemId: string, items: Item[]): Item | undefined => {
        for (const item of items) {
            if (item.id === itemId) {
                return item;
            }
            if (item.isDirectory) {
                const foundItem = findItemById(itemId, item.children);
                if (foundItem) {
                    return foundItem;
                }
            }
        }
        return undefined;
    };

    const navigateToNextItem = () => {
        if (!currentItemId) {
            setCurrentItemId(expandedItems[0]?.id || null);
            return;
        }
        const currentItem = findItemByIdInFilteredItems(
            currentItemId,
            expandedItems
        );
        if (!currentItem) {
            return;
        }
        if (
            currentItem.isDirectory &&
            currentItem.isExpanded &&
            currentItem.children.length > 0
        ) {
            setCurrentItemId(currentItem.children[0]?.id || null);
        } else {
            const flattenedItems = flattenItems(expandedItems);
            const currentIndex = flattenedItems.findIndex(
                (item) => item.id === currentItemId
            );
            const nextIndex = (currentIndex + 1) % flattenedItems.length;
            setCurrentItemId(flattenedItems[nextIndex]?.id || null);
        }
    };

    const navigateToPreviousItem = () => {
        if (!currentItemId) {
            return;
        }
        const flattenedItems = flattenItems(expandedItems);
        const currentIndex = flattenedItems.findIndex(
            (item) => item.id === currentItemId
        );
        const previousIndex =
            (currentIndex - 1 + flattenedItems.length) % flattenedItems.length;
        setCurrentItemId(flattenedItems[previousIndex]?.id || null);
    };

    const flattenItems = (items: Item[]): Item[] => {
        const flattenedItems: Item[] = [];

        const traverseItems = (items: Item[]) => {
            for (const item of items) {
                flattenedItems.push(item);
                if (item.isDirectory && item.isExpanded) {
                    traverseItems(item.children);
                }
            }
        };

        traverseItems(items);
        return flattenedItems;
    };

    const toggleFolderExpansion = () => {
        if (!currentItemId) {
            return;
        }

        const currentItem = findItemById(currentItemId, items);
        if (currentItem && currentItem.isDirectory) {
            currentItem.isExpanded = !currentItem.isExpanded;
        }
        setItems(
            items.map((item) => {
                if (item.id === currentItem?.id) {
                    return currentItem;
                }
                return item;
            })
        );
    };

    const expandParentFolders = (item: Item, items: Item[]): Item[] => {
        return items.map((i) => {
            if (i.id === item.id) {
                return { ...i, isExpanded: true };
            }
            if (i.isDirectory && item.path.startsWith(i.path)) {
                return {
                    ...i,
                    isExpanded: true,
                    children: expandParentFolders(item, i.children),
                };
            }
            return i;
        });
    };

    const searchItems = (items: Item[], query: string): Item[] => {
        return items.reduce((result, item) => {
            if (item.isDirectory) {
                const matchingChildren = searchItems(item.children, query);
                if (matchingChildren.length > 0) {
                    const expandedItem = {
                        ...item,
                        isExpanded: true,
                        children: matchingChildren,
                    };
                    result.push(expandedItem);
                }
            } else if (item.name.toLowerCase().includes(query.toLowerCase())) {
                result.push(item);
            }
            return result;
        }, [] as Item[]);
    };

    const renderItems = (items: Item[], indentationLevel = 0): ReactNode[] => {
        return items.map((item) => (
            <Box key={item.path} flexDirection="column">
                <Box marginLeft={indentationLevel} key={item.id}>
                    <Text
                        color={
                        item.id === currentItemId
                            ? COLORS.current
                            : selectedItems.find((selectedItem) => selectedItem.id === item.id)
                            ? COLORS.selected
                            : COLORS.default
                        }
                        bold={item.id === currentItemId}
                    >
                        {selectedItems.find((selectedItem) => selectedItem.id === item.id)
                        ? ICONS.SELECTED
                        : ICONS.NOT_SELECTED}{" "}
                        {item.isDirectory
                        ? item.isExpanded
                            ? ICONS.FOLDER_OPEN
                            : ICONS.FOLDER_CLOSED
                        : ICONS.FILE}{" "}
                        {item.name}
                        {item.isDirectory && "/"}
                    </Text>
                </Box>
                {item.isDirectory &&
                    item.isExpanded &&
                    item.children.length > 0 &&
                    renderItems(item.children, indentationLevel + 2)}
            </Box>
        ));
    };


    const filteredItems = searchQuery ? searchItems(items, searchQuery) : items;
    const expandedItems = filteredItems.reduce((result, item) => {
        if (item.isDirectory && item.isExpanded) {
            return expandParentFolders(item, result);
        }
        return result;
    }, filteredItems);

    useEffect(() => {
        // Get the first file that is not a directory
        const firstFile = expandedItems[0];
        if (firstFile && firstFile.isDirectory) {
            const itemsInFolder = getItemsFromFolder(firstFile);
            const firstItem = itemsInFolder.find((item) => !item.isDirectory);
            if (searchQuery === "") {
                setCurrentItemId(firstFile.id);
            } else {
                setCurrentItemId(firstItem?.id || null);
            }
        } else {
            if (firstFile) {
                setCurrentItemId(firstFile.id);
            }
        }
    }, [searchQuery]);

    return (
        <Box flexDirection="column" marginTop={2} marginBottom={2}>
            <Box flexDirection="column" marginBottom={1}>
                <Box>
                    <Text color={COLORS.info}>Search: </Text>
                    <Text color={COLORS.search} italic>{searchQuery ? searchQuery : "type to search"}</Text>
                </Box>
            
                <Box> 
                    <Text color={'gray'}>
                        Selected:{" "}
                        <Text color="cyan">{selectedItems.length}</Text>
                    </Text>
                </Box>
            </Box>
            <Box flexDirection="column">
                {renderItems(expandedItems)}
                {expandedItems.length === 0 && (
                    <Text color="gray" italic>
                        No items found
                    </Text>
                )}
            </Box>
            {message && (
                <Box marginTop={1}>
                    <Text>{message}</Text>
                </Box>
            )}
        </Box>


    );
};

export default App;
