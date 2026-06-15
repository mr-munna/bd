import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// I am modifying the string it matches and what it replaces with
// Replace the old replacements with ones that include "editing-input-active"
content = content.replace(/className="w-full h-full min-h-\[44px\] px-3 py-2 bg-blue-50\/50 border-2 border-transparent focus:border-blue-500 outline-none m-0 text-inherit text-sm resize-none rounded-none"/g, `className="w-full h-full min-h-[44px] px-4 py-3 bg-blue-50/50 border-2 border-transparent focus:border-blue-500 outline-none m-0 text-inherit text-sm resize-none rounded-none editing-input-active"`);
content = content.replace(/className="w-full h-full min-h-\[44px\] px-3 py-2 bg-blue-50\/50 border-2 border-transparent focus:border-blue-500 outline-none m-0 text-center text-inherit text-sm resize-none rounded-none"/g, `className="w-full h-full min-h-[44px] px-4 py-3 bg-blue-50/50 border-2 border-transparent focus:border-blue-500 outline-none m-0 text-center text-inherit text-sm resize-none rounded-none editing-input-active"`);
content = content.replace(/className="w-full h-full min-w-\[80px\] min-h-\[44px\] px-3 py-2 bg-blue-50\/50 border-2 border-transparent focus:border-blue-500 outline-none m-0 text-center text-inherit text-sm resize-none rounded-none"/g, `className="w-full h-full min-w-[80px] min-h-[44px] px-4 py-3 bg-blue-50/50 border-2 border-transparent focus:border-blue-500 outline-none m-0 text-center text-inherit text-sm resize-none rounded-none editing-input-active"`);

fs.writeFileSync('src/App.tsx', content);

console.log('Successfully updated input styles to include editing-input-active in App.tsx');
