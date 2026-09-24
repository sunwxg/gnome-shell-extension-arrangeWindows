import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const KEY_GAP = 'gap';

const SHORTCUTS = [
    ['Cascade', 'arrangewindow-cascade'],
    ['Tile', 'arrangewindow-tile'],
    ['Side by side', 'arrangewindow-sidebyside'],
    ['Stack', 'arrangewindow-stack'],
    ['Master left', 'arrangewindow-masterleft'],
    ['Master right', 'arrangewindow-masterright'],
    ['Maximize', 'arrangewindow-maximize'],
    ['Maximize Vertical', 'arrangewindow-maximizevertical'],
    ['Maximize Horizontal', 'arrangewindow-maximizehorizontal'],
    ['Restoring', 'arrangewindow-restoring'],
];

const IGNORED_KEYVALS = [
    Gdk.KEY_Control_L,
    Gdk.KEY_Control_R,
    Gdk.KEY_Shift_L,
    Gdk.KEY_Shift_R,
    Gdk.KEY_Alt_L,
    Gdk.KEY_Alt_R,
    Gdk.KEY_Super_L,
    Gdk.KEY_Super_R,
    Gdk.KEY_Meta_L,
    Gdk.KEY_Meta_R,
];

const MIN_LETTER_KEYVAL = Gdk.KEY_a;
const MAX_LETTER_KEYVAL = Gdk.KEY_z;
const CAPTURE_TEXT = 'recording shortcut';

function buildPrefsPage(settings) {
    let page = new Adw.PreferencesPage();

    let generalGroup = new Adw.PreferencesGroup({
        title: 'General',
    });

    let gapRow = new Adw.SpinRow({
        title: 'Gap Between Windows',
        adjustment: new Gtk.Adjustment({
            lower: 0,
            upper: 1000,
            step_increment: 1,
            page_increment: 1,
        }),
    });
    settings.bind(KEY_GAP, gapRow, 'value', Gio.SettingsBindFlags.DEFAULT);
    generalGroup.add(gapRow);

    page.add(generalGroup);

    let shortcutGroup = new Adw.PreferencesGroup({
        title: 'Keyboard Shortcuts',
    });

    for (let [label, key] of SHORTCUTS)
        shortcutGroup.add(createShortcutRow(label, key, settings));

    page.add(shortcutGroup);

    return page;
}

function createShortcutRow(string, key, gsettings) {
    let row = new Adw.ActionRow({
        title: string,
    });

    let button = new Gtk.Button({
        width_request: 170,
        focusable: true,
        valign: Gtk.Align.CENTER,
    });

    let stack = new Gtk.Stack();
    let shortcutLabel = new Adw.ShortcutLabel({disabled_text: 'Disabled'});
    let captureLabel = new Gtk.Label({label: CAPTURE_TEXT});
    stack.add_named(shortcutLabel, 'shortcut');
    stack.add_named(captureLabel, 'capture');
    button.set_child(stack);
    row.add_suffix(button);

    let resetButton = new Gtk.Button({
        icon_name: 'edit-undo-symbolic',
        tooltip_text: 'Reset to default shortcut',
        valign: Gtk.Align.CENTER,
    });
    row.add_suffix(resetButton);

    let capturing = false;

    function currentAccelerator() {
        return gsettings.get_strv(key)[0] ?? '';
    }

    function update() {
        shortcutLabel.set_accelerator(currentAccelerator());
        stack.set_visible_child_name(capturing ? 'capture' : 'shortcut');
        button.set_tooltip_text(capturing ? CAPTURE_TEXT : 'Click to change shortcut');
        resetButton.set_sensitive(gsettings.get_user_value(key) !== null);
    }

    function stopCapturing() {
        if (!capturing)
            return;

        capturing = false;
        update();
    }

    function isPlainLetter(keyval, modifiers) {
        let lowerKeyval = Gdk.keyval_to_lower(keyval);

        return modifiers === 0 &&
            lowerKeyval >= MIN_LETTER_KEYVAL &&
            lowerKeyval <= MAX_LETTER_KEYVAL;
    }

    button.connect('clicked', () => {
        capturing = true;
        button.grab_focus();
        update();
    });

    resetButton.connect('clicked', () => {
        capturing = false;
        gsettings.reset(key);
        update();
    });

    let controller = new Gtk.EventControllerKey();
    controller.connect('key-pressed', (_controller, keyval, _keycode, state) => {
        if (!capturing)
            return false;

        if (keyval === Gdk.KEY_Escape) {
            stopCapturing();
            return true;
        }

        if (IGNORED_KEYVALS.includes(keyval))
            return true;

        let modifiers = state & Gtk.accelerator_get_default_mod_mask();

        if (keyval === Gdk.KEY_BackSpace && modifiers === 0) {
            gsettings.set_strv(key, []);
            stopCapturing();
            return true;
        }

        if (isPlainLetter(keyval, modifiers))
            return true;

        let accelerator = Gtk.accelerator_name(keyval, modifiers);

        if (Gtk.accelerator_valid(keyval, modifiers))
            gsettings.set_strv(key, [accelerator]);

        stopCapturing();
        return true;
    });
    button.add_controller(controller);

    let focusController = new Gtk.EventControllerFocus();
    focusController.connect('leave', () => stopCapturing());
    button.add_controller(focusController);

    gsettings.connect(`changed::${key}`, update);

    update();
    return row;
}

export default class ArrangeWindowsPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window.search_enabled = true;
        window.add(buildPrefsPage(this.getSettings()));
    }
}
