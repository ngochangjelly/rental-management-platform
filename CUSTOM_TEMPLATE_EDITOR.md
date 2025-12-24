# Custom Contract Template Editor

A powerful document editor for creating and customizing contract templates with PDF/DOCX upload support and live editing capabilities.

## Features

### 🎨 Rich Text Editing
- Full-featured WYSIWYG editor powered by Quill
- Microsoft Word-like editing experience
- Support for text formatting: bold, italic, underline, strike-through
- Multiple heading levels and font sizes
- Color and background color customization
- Lists (ordered and unordered)
- Text alignment options
- Links and images support

### 📄 Document Upload
- **PDF Support**: Upload existing PDF contracts and extract text
- **DOCX Support**: Upload Microsoft Word documents with formatting preserved
- Automatic text extraction and conversion
- Drag-and-drop file upload (coming soon)

### 🔖 Variable Placeholders
Insert dynamic placeholders that can be replaced with actual data:
- `{{TENANT_NAME}}` - Tenant's full name
- `{{LANDLORD_NAME}}` - Landlord/Investor name
- `{{PROPERTY_ADDRESS}}` - Full property address
- `{{ROOM_NUMBER}}` - Room or unit number
- `{{MONTHLY_RENT}}` - Monthly rental amount
- `{{SECURITY_DEPOSIT}}` - Security deposit amount
- `{{START_DATE}}` - Lease start date
- `{{END_DATE}}` - Lease end date
- `{{AGREEMENT_DATE}}` - Contract signing date
- `{{PAYMENT_METHOD}}` - Payment method details

### 💾 Template Management
- **Save Templates**: Store custom templates for reuse
- **Load Templates**: Quick access to saved templates
- **Template Library**: Manage multiple templates
- **Auto-save**: Automatic saving every 30 seconds
- **Recovery**: Restore unsaved work from autosave

### 📤 Export Options
- **PDF Export**: Generate high-quality PDF documents
- **Live Preview**: Preview before exporting
- **Formatting Preservation**: Maintains all formatting in exports

## How to Use

### 1. Access the Editor
Navigate to the dashboard and click on "Custom Template Editor" in the sidebar menu.

### 2. Upload a Document (Optional)
1. Click the "Upload PDF/DOCX" button
2. Select a PDF or DOCX file from your computer
3. The document will be automatically processed and loaded into the editor
4. Edit the content as needed

### 3. Create or Edit Content
- Use the toolbar to format text
- Type directly in the editor
- Copy and paste from other documents
- Insert variable placeholders for dynamic content

### 4. Insert Variable Placeholders
1. Click "Insert Placeholder" button
2. Select the variable you want to insert
3. The placeholder will be added at the cursor position
4. These can be replaced with actual values when creating contracts

### 5. Save Your Template
1. Click "Save Template" button
2. Enter a name for your template
3. The template is saved to your browser's local storage
4. Access it anytime using "Load Template"

### 6. Export to PDF
1. Click "Export to PDF" button
2. The system will generate a PDF with all your formatting
3. Download the PDF to your computer
4. Use it for contracts, signatures, or records

## Technical Details

### Libraries Used
- **Quill**: Rich text editor (https://quilljs.com/)
- **Mammoth**: DOCX to HTML converter
- **PDF.js**: PDF text extraction
- **jsPDF**: PDF generation
- **html2canvas**: HTML to canvas rendering

### Browser Compatibility
- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Basic support

### Storage
- Templates are stored in browser's localStorage
- Autosave data is kept for 24 hours
- No server-side storage (privacy-focused)

### File Size Limits
- PDF files: Up to 50MB recommended
- DOCX files: Up to 20MB recommended
- Larger files may take longer to process

## Tips and Best Practices

1. **Use Variables**: Insert placeholders for data that changes per contract
2. **Save Often**: While autosave is enabled, manually save important templates
3. **Test Exports**: Preview and export test PDFs to verify formatting
4. **Organize Templates**: Use descriptive names for easy identification
5. **Keep Backups**: Download important templates as PDFs for backup

## Troubleshooting

### Document Upload Issues
- **Problem**: PDF text appears garbled
  - **Solution**: Some PDFs use image-based text. Try a different PDF or retype the content.

- **Problem**: DOCX formatting is lost
  - **Solution**: Complex formatting may not convert perfectly. Adjust manually in the editor.

### Export Issues
- **Problem**: PDF export is incomplete
  - **Solution**: Long documents may need pagination. Check the preview first.

- **Problem**: Formatting looks different in PDF
  - **Solution**: Use the preview feature to check before exporting.

### Performance
- **Problem**: Editor is slow
  - **Solution**: Very large documents may impact performance. Consider breaking into smaller sections.

## Future Enhancements

- [ ] Drag-and-drop file upload
- [ ] Cloud storage integration
- [ ] Template sharing between users
- [ ] More export formats (Word, HTML, TXT)
- [ ] Collaborative editing
- [ ] Template versioning
- [ ] Advanced find and replace
- [ ] Spell check integration
- [ ] Table support
- [ ] Digital signature integration

## Support

For issues or questions:
1. Check this documentation
2. Review the Quick Tips in the editor sidebar
3. Contact the development team

---

**Version**: 1.0.0
**Last Updated**: December 2024
**Component**: Custom Contract Template Editor
