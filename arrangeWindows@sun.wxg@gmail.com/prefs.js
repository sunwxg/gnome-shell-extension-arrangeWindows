const Gtk = imports.gi.Gtk;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
let gsettings;

const SCHEMA_NAME = 'org.gnome.shell.extensions.arrangeWindows';
const KEY_GAP = 'gap';

function init() {
}

function buildPrefsWidget() {
    gsettings = ExtensionUtils.getSettings(SCHEMA_NAME);

    let widget = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 10,
        margin_bottom: 10,
        margin_start: 10,
        margin_end: 10,
    });

    let vbox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 10
    });
    vbox.set_size_request(550, 350);

    vbox.append(addSpinButton("Gap between windows", KEY_GAP));

    widget.append(vbox);

    return widget;
}

function addSpinButton(string, key) {
        let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 20});
        let info = new Gtk.Label({xalign: 0, hexpand: true});
        info.set_markup(string);
        hbox.append(info);

        let button = new Gtk.SpinButton();
        button.set_range(0, 1000);
        button.set_increments(1, 1);
        button.set_value(gsettings.get_int(key));
        button.connect('value_changed', (button) => { gsettings.set_int(key, button.get_value_as_int()); });
        hbox.append(button);
        return hbox;
    }
