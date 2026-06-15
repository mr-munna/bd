import * as fs from 'fs';

function processFile(path: string) {
  let code = fs.readFileSync(path, 'utf8');

  // Replace inside TableCell
  code = code.replace(/<TableCell([^>]*)>([\s\S]*?(?=<\/TableCell>))<\/TableCell>/g, (match, props, children) => {
      let newProps = props.replace(/font-black/g, 'font-normal').replace(/font-bold/g, 'font-normal');
      newProps = newProps.replace(/text-black/g, 'text-gray-800');
      let newChildren = children.replace(/font-black/g, 'font-normal').replace(/font-bold/g, 'font-normal');
      return `<TableCell${newProps}>${newChildren}</TableCell>`;
  });

  // Replace inside TableHeader
  code = code.replace(/<TableHeader([^>]*)>([\s\S]*?(?=<\/TableHeader>))<\/TableHeader>/g, (match, props, children) => {
      let newProps = props.replace(/font-black/g, 'font-normal').replace(/font-bold/g, 'font-normal');
      let newChildren = children.replace(/font-black/g, 'font-normal').replace(/font-bold/g, 'font-normal');
      return `<TableHeader${newProps}>${newChildren}</TableHeader>`;
  });

  // For Sales.tsx or general th/td elements styling inside Tables
  // Replace <th ... font-bold ...>  with font-normal
  code = code.replace(/<th([^>]*)>/g, (match, props) => {
      let newProps = props.replace(/font-black/g, 'font-normal').replace(/font-bold/g, 'font-normal');
      return `<th${newProps}>`;
  });
  
  // Replace <td ... font-bold... > with font-normal
  code = code.replace(/<td([^>]*)>/g, (match, props) => {
      let newProps = props.replace(/font-black/g, 'font-normal').replace(/font-bold/g, 'font-normal');
      return `<td${newProps}>`;
  });

  fs.writeFileSync(path, code);
}

processFile('src/App.tsx');
if (fs.existsSync('src/Sales.tsx')) {
  processFile('src/Sales.tsx');
}
console.log('Tables updated successfully.');
