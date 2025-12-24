# Quick Start Guide - Custom Template Editor

## 🚀 Getting Started in 5 Minutes

### Step 1: Access the Editor
1. Open your rental management dashboard
2. Look for **"Custom Template Editor"** in the left sidebar (📄 icon)
3. Click to open the editor

### Step 2: Choose Your Starting Point

#### Option A: Upload an Existing Contract
```
1. Click "Upload PDF/DOCX" button
2. Select your contract file
3. Wait for processing (usually 2-5 seconds)
4. Start editing!
```

#### Option B: Start from Scratch
```
1. Click "New Template" button
2. Start typing in the editor
3. Use the toolbar for formatting
```

#### Option C: Load a Saved Template
```
1. Click "Load Template" button
2. Choose from your saved templates
3. Continue editing
```

## 🎨 Editing Your Contract

### Formatting Toolbar (Top of Editor)
```
[H1 H2 H3] - Headings
[B I U S]  - Bold, Italic, Underline, Strikethrough
[🎨]       - Text and background colors
[≡ ≣]      - Lists (bullets and numbers)
[← ≡ →]    - Text alignment
[" < >]    - Quotes and code blocks
```

### Adding Dynamic Fields
1. Click **"Insert Placeholder"** button (⚡ icon)
2. Select a variable (e.g., `{{TENANT_NAME}}`)
3. Variable appears in blue text at cursor
4. These will be replaced with real data later

**Available Variables:**
- `{{TENANT_NAME}}` - For tenant's name
- `{{PROPERTY_ADDRESS}}` - For property location
- `{{MONTHLY_RENT}}` - For rent amount
- And 7 more...

## 💾 Saving Your Work

### Auto-Save (Automatic)
- ✅ Saves every 30 seconds automatically
- ✅ Keeps last version for 24 hours
- ✅ Recovers if browser crashes

### Manual Save (Recommended)
1. Click **"Save Template"** button
2. Give it a memorable name (e.g., "Standard Lease Agreement")
3. Click OK
4. Template is saved forever (until you delete it)

## 📤 Exporting to PDF

### Quick Export
```
1. Click "Export to PDF" button
2. PDF generates in 2-3 seconds
3. Download automatically starts
4. Done! ✅
```

### Preview First (Recommended)
```
1. Click "Preview" button
2. Review how it looks
3. Close preview
4. Make any adjustments
5. Then click "Export to PDF"
```

## 💡 Pro Tips

### Tip 1: Use Templates for Common Contracts
Save different templates for different property types:
- "Condo Lease Template"
- "HDB Lease Template"
- "Commercial Lease Template"

### Tip 2: Keep Variables for Reusability
Don't hardcode tenant names or amounts. Use:
- ❌ "John Smith"
- ✅ `{{TENANT_NAME}}`

This way one template works for all tenants!

### Tip 3: Preview Before Exporting
Always preview large documents. It ensures:
- Proper formatting
- No cut-off text
- Professional appearance

### Tip 4: Organize Your Templates
Use clear naming conventions:
```
✅ "2024 Standard Lease - Updated Oct"
✅ "Short Term Rental - 3 Month"
✅ "Commercial Property Agreement"

❌ "Template 1"
❌ "New"
❌ "asdf"
```

### Tip 5: Keep Backups
Important templates should be:
1. Saved in the editor
2. Exported as PDF
3. Stored in your documents folder

## 🔧 Common Tasks

### Task: Create a New Contract Template
```
1. Click "New Template"
2. Type or paste your contract text
3. Format headings (use H2 for sections)
4. Replace names/amounts with {{VARIABLES}}
5. Save with descriptive name
6. Export to PDF for backup
```

### Task: Update an Existing Template
```
1. Click "Load Template"
2. Select the template
3. Make your changes
4. Click "Save Template" (use same name to overwrite)
5. Confirm the save
```

### Task: Convert PDF to Editable Template
```
1. Click "Upload PDF/DOCX"
2. Select your PDF
3. Wait for text extraction
4. Clean up any formatting issues
5. Add {{VARIABLES}} where needed
6. Save as new template
```

### Task: Create Contract Variations
```
1. Load your base template
2. Make specific changes
3. Save with new name (e.g., "Base Template - Version 2")
4. Both versions now available
```

## ⚠️ Troubleshooting

### Problem: PDF Upload Doesn't Work
**Solutions:**
- Check file is actually a PDF
- Try a different PDF
- If PDF is scanned/image-based, retype the text
- File might be too large (try <50MB)

### Problem: Formatting Looks Wrong
**Solutions:**
- Use the Preview function
- Adjust using the toolbar
- Try exporting to PDF to see final result
- Complex DOCX may need manual fixes

### Problem: Can't Find Saved Template
**Solutions:**
- Check you're on the same browser/computer
- Templates saved in browser storage (not cloud)
- Click "Load Template" to see all saved templates
- Search by name

### Problem: Variable Doesn't Insert
**Solutions:**
- Click in editor first to place cursor
- Then click "Insert Placeholder"
- Select your variable
- It appears at cursor position

## 📊 What's Stored Where?

```
🌐 Browser (localStorage)
   ├── Your saved templates (permanent)
   ├── Auto-save data (24 hours)
   └── Template metadata

💾 Your Computer
   └── Exported PDFs (when you download)

☁️ Not in Cloud
   └── For privacy, nothing stored online
```

## 🎯 Real-World Example

**Scenario**: Create a standard lease agreement for all HDB properties

1. **Upload** your current HDB lease PDF
2. **Review** extracted text, fix any issues
3. **Replace** specific details with variables:
   - "Tan Ah Kow" → `{{TENANT_NAME}}`
   - "Blk 123 Jurong West" → `{{PROPERTY_ADDRESS}}`
   - "$1,500" → `{{MONTHLY_RENT}}`
4. **Format** section headings with H2
5. **Add** any clauses using the editor
6. **Save** as "HDB Standard Lease 2024"
7. **Export** as PDF for your records

Now when you need a new contract:
1. Load "HDB Standard Lease 2024"
2. Replace variables with actual data
3. Export as PDF
4. Print and sign!

## 🆘 Need Help?

1. Check the **Quick Tips** in the sidebar (lightbulb icon)
2. Read [CUSTOM_TEMPLATE_EDITOR.md](CUSTOM_TEMPLATE_EDITOR.md) for full details
3. Review [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical info
4. Contact your system administrator

## ⌨️ Keyboard Shortcuts

- **Ctrl/Cmd + B** - Bold
- **Ctrl/Cmd + I** - Italic
- **Ctrl/Cmd + U** - Underline
- **Ctrl/Cmd + Z** - Undo
- **Ctrl/Cmd + Y** - Redo
- **Ctrl/Cmd + S** - (Browser save, not template save)

## 🎉 You're Ready!

That's it! You now know how to:
- ✅ Upload and convert documents
- ✅ Edit with rich formatting
- ✅ Use dynamic variables
- ✅ Save and manage templates
- ✅ Export professional PDFs

Start creating your first template now! 🚀

---

**Questions?** See the full documentation in [CUSTOM_TEMPLATE_EDITOR.md](CUSTOM_TEMPLATE_EDITOR.md)
