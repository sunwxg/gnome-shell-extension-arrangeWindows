import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const KEY_GAP = 'gap';
const SHOW_PANEL_BUTTON = 'show-panel-button';
const ENABLE_SHORTCUTS = 'enable-shortcuts';
const HOTKEY_CASCADE = 'arrangewindow-cascade';
const HOTKEY_TILE = 'arrangewindow-tile';
const HOTKEY_SIDEBYSIDE = 'arrangewindow-sidebyside';
const HOTKEY_STACK = 'arrangewindow-stack';

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
    vbox.set_size_request(550, 450);

    // Добавляем новые переключатели
    vbox.append(addSwitch("Show Panel Button", SHOW_PANEL_BUTTON, gsettings));
    vbox.append(addSwitch("Enable Keyboard Shortcuts", ENABLE_SHORTCUTS, gsettings));
    
    // Добавляем разделитель
    let separator = new Gtk.Separator({ margin_top: 20, margin_bottom: 20 });
    vbox.append(separator);

    // Добавляем настройки горячих клавиш
    vbox.append(addShortcutEntry("Cascade Windows Shortcut", HOTKEY_CASCADE, gsettings));
    vbox.append(addShortcutEntry("Tile Windows Shortcut", HOTKEY_TILE, gsettings));
    vbox.append(addShortcutEntry("Side by Side Shortcut", HOTKEY_SIDEBYSIDE, gsettings));
    vbox.append(addShortcutEntry("Stack Windows Shortcut", HOTKEY_STACK, gsettings));
    
    // Добавляем разделитель
    let separator2 = new Gtk.Separator({ margin_top: 20, margin_bottom: 20 });
    vbox.append(separator2);
    
    // Существующие настройки
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

function addSwitch(string, key, gsettings) {
    let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 20 });
    let info = new Gtk.Label({ xalign: 0, hexpand: true });
    info.set_markup(string);
    hbox.append(info);

    let toggle = new Gtk.Switch({
        active: gsettings.get_boolean(key),
        halign: Gtk.Align.END
    });
    toggle.connect('notify::active', (button) => {
        gsettings.set_boolean(key, button.active);
    });
    hbox.append(toggle);
    return hbox;
}

function addShortcutEntry(string, key, gsettings) {
    let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, margin_top: 15 });
    let info = new Gtk.Label({ xalign: 0, hexpand: true });
    info.set_markup(string);
    hbox.append(info);

    let currentKeys = gsettings.get_strv(key);
    let entry = new Gtk.Entry({
        text: currentKeys.length > 0 ? currentKeys[0] : '',
        halign: Gtk.Align.END,
        width_chars: 20
    });
    
    entry.connect('changed', (entry) => {
        let newKey = entry.get_text().trim();
        if (newKey) {
            gsettings.set_strv(key, [newKey]);
        } else {
            gsettings.set_strv(key, []);
        }
    });
    
    hbox.append(entry);
    return hbox;
}

export default class ArrangeWindowsPrefs extends ExtensionPreferences {
    getPreferencesWidget() {
        return buildPrefsWidget(this.getSettings());
    }
}