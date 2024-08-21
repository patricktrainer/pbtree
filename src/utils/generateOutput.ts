import fs from "fs";

interface Item {
  id: string;
  name: string;
  isDirectory: boolean;
  children: Item[];
  path: string;
  isExpanded: boolean;
  level: number;
}

interface OutputResult {
  content: string;
  fileCount: number;
}

export function outputXml(selectedItems: Item[]): OutputResult {
  let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<files>\n';
  let fileCount = 0;
  const processedPaths = new Set<string>();

  const processItem = (item: Item, indent: string = "  ") => {
    if (processedPaths.has(item.path)) {
      return; // Skip if this path has already been processed
    }
    processedPaths.add(item.path);

    if (item.isDirectory) {
      xmlContent += `${indent}<directory name="${item.name}" path="${item.path}">\n`;
      item.children.forEach((child) => processItem(child, indent + "  "));
      xmlContent += `${indent}</directory>\n`;
    } else {
      xmlContent += `${indent}<file name="${item.name}" path="${item.path}">\n`;
      try {
        const content = fs.readFileSync(item.path, "utf-8");
        xmlContent += `${indent}  <content><![CDATA[${content}]]></content>\n`;
        fileCount++;
      } catch (error) {
        xmlContent += `${indent}  <error>Failed to read file content</error>\n`;
      }
      xmlContent += `${indent}</file>\n`;
    }
  };

  // Sort items to ensure consistent output
  const sortedItems = selectedItems.sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  // Process all items
  sortedItems.forEach((item) => processItem(item));

  xmlContent += "</files>";
  return { content: xmlContent, fileCount };
}
