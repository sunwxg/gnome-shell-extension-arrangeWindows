import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const KEY_GAP = 'gap';

function buildPrefsWidget(settings) {
    let gsettings = settings;

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

    vbox.append(addSpinButton("Gap Between Windows", KEY_GAP, gsettings));

    widget.append(vbox);

    return widget;
}

function addSpinButton(string, key, gsettings) {
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

export default class ArrangeWindowsPrefs extends ExtensionPreferences {
    getPreferencesWidget() {
        return buildPrefsWidget(this.getSettings());
    }
}

