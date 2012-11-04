Ext.define('pjs.ui.TextureField', {
	extend: 'pjs.ui.FieldBase',

	requires: [
		'pjs.ui.FieldBase',
		'Ext.form.field.File'
	],

	alias: 'widget.pjstexture',
	layout: 'vbox',

	initComponent: function() {
		this.items = [{
			xtype: 'filefield',
			labelAlign: 'right',
			fieldLabel: 'image',
			allowBlank: false,
			buttonText: 'Select image...',
			listeners: {
				change: this._onChange,
				scope: this
			}
		}];

		this.callParent(arguments);
	},

	_onChange: function(fileField) {
		var fileEl = fileField.fileInputEl.dom;

		if(fileEl.files && fileEl.files[0]) {
			pjs.ui.TextureLoader.load(this.target, this.property, fileEl.files[0]);
			fileEl.value = '';
		}
	}
});

