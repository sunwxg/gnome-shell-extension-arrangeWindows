// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Mainloop = imports.mainloop;
const GObject = imports.gi.GObject;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Tweener = imports.ui.tweener;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Slider = imports.ui.slider;
const Conf = imports.misc.config;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const CASCADE_WIDTH = 30;
const CASCADE_HEIGHT = 30;
const MIN_WINDOW_WIDTH = 500;

const ARRANGEWINDOWS_SCHEMA = 'org.gnome.shell.extensions.arrangeWindows';
const ALL_MONITOR = 'all-monitors';
const COLUMN_NUMBER = 'column';
const HOTKEY_CASCADE = 'hotkey-cascade';
const HOTKEY_TILE = 'hotkey-tile';
const HOTKEY_SIDEBYSIDE = 'hotkey-sidebyside';
const HOTKEY_STACK = 'hotkey-stack';

const COLUMN = ['2', '3', '4', '5', '6', '7', '8'];

let ArrangeMenu = GObject.registerClass(
class ArrangeMenu extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Arrange Windows'));

        this._gsettings = Convenience.getSettings(ARRANGEWINDOWS_SCHEMA);

        this._allMonitor = this._gsettings.get_boolean(ALL_MONITOR);

        let icon = new St.Icon({ gicon: this._getCustIcon('arrange-windows-symbolic'),
                                 style_class: 'system-status-icon' });
        this.add_actor(icon);

        this.menu.addAction(_("Cascade"),
                            () => this.cascadeWindow(),
                            this._getCustIcon('cascade-windows-symbolic'));

        this.menu.addAction(_("Tile"),
                            () => this.tileWindow(),
                            this._getCustIcon('tile-windows-symbolic'));

        this.menu.addAction(_("Side by side"),
                            () => this.sideBySideWindow(),
                            this._getCustIcon('sidebyside-windows-symbolic'));

        this.menu.addAction(_("Stack"),
                            () => this.stackWindow(),
                            this._getCustIcon('stack-windows-symbolic'));

        this.menu.addAction(_("Maximize"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.BOTH),
                            this._getCustIcon('maximize-windows-symbolic'));

        this.menu.addAction(_("Maximize Vertical"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.VERTICAL),
                            this._getCustIcon('maximize-vertical-windows-symbolic'));

        this.menu.addAction(_("Maximize Horizontal"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.HORIZONTAL),
                            this._getCustIcon('maximize-horizontal-windows-symbolic'));

        this.menu.addAction(_("Restoring"),
                            () => this.restoringWindow(),
                            this._getCustIcon('restoring-window-symbolic'));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._allMonitorItem = new PopupMenu.PopupSwitchMenuItem(_("All monitors"), this._allMonitor)
        this._allMonitorItem.connect('toggled', this._allMonitorToggle.bind(this));
        this.menu.addMenuItem(this._allMonitorItem);

        this._column = new Column();
        this.menu.addMenuItem(this._column.menu);

        this.show();

        this.addKeybinding();
        this.connect('destroy', this._onDestroy.bind(this));
    }

    cascadeWindow() {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);

        let y = workArea.y + 5;
        let x = workArea.x + 10;
        let width = workArea.width * 0.7;
        let height = workArea.height * 0.7;
        for (let i = 0; i < windows.length; i++) {
            let win = windows[i].get_meta_window();
            win.unmaximize(Meta.MaximizeFlags.BOTH);
            win.move_resize_frame(true, x, y, width, height);
            x = x + CASCADE_WIDTH;
            y = y + CASCADE_HEIGHT;
        }
    }

    sideBySideWindow() {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);
        let width = Math.round(workArea.width / windows.length)

        let y = workArea.y;
        let x = workArea.x;
        for (let i = 0; i < windows.length; i++) {
            let win = windows[i].get_meta_window();
            win.unmaximize(Meta.MaximizeFlags.BOTH);
            win.move_resize_frame(false, x, y, width, workArea.height);
            x = x + width;
        }
    }

    stackWindow() {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);
        let height = Math.round(workArea.height / windows.length)

        let y = workArea.y;
        let x = workArea.x;
        for (let i = 0; i < windows.length; i++) {
            let win = windows[i].get_meta_window();
            win.unmaximize(Meta.MaximizeFlags.BOTH);
            win.move_resize_frame(false, x, y, workArea.width, height);
            y += height;
        }
    }

    tileWindow() {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);

        let columnNumber = parseInt(COLUMN[this._gsettings.get_int(COLUMN_NUMBER)]);
        let rowNumber = Math.floor(windows.length / columnNumber) + ((windows.length % columnNumber) > 0 ? 1 : 0);
        let width = Math.round(workArea.width / columnNumber)
        let height = Math.round(workArea.height/ rowNumber)
        let x = workArea.x;
        let y = workArea.y;

        for (let i = 0; i < windows.length; i++) {
            let row = Math.floor(i / columnNumber);
            let column = i % columnNumber;
            x = workArea.x + width * column;
            y = workArea.y + height * row;

            let win = windows[i].get_meta_window();
            win.unmaximize(Meta.MaximizeFlags.BOTH);
            win.move_resize_frame(false, x, y, width, height);
        }
    }

    maximizeWindow(direction) {
        if (this._allMonitor == true) {
            this.maximizeWindowAllMonitor(direction);
            return;
        }

        let windows = this.getWindows();

        for (let i = 0; i < windows.length; i++) {
            let actor = windows[i];
            let win = actor.get_meta_window();
            win.maximize(direction);
        }
    }

    maximizeWindowAllMonitor(direction) {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);

        for (let i = 0; i < windows.length; i++) {
            let win = windows[i].get_meta_window();

            switch (direction) {
                case Meta.MaximizeFlags.BOTH:
                    win.move_resize_frame(true,
                                          workArea.x,
                                          workArea.y,
                                          workArea.width,
                                          workArea.height);
                    break;
                case Meta.MaximizeFlags.VERTICAL:
                    win.move_resize_frame(true,
                                          win.get_frame_rect().x,
                                          workArea.y,
                                          win.get_frame_rect().width,
                                          workArea.height);
                    break;
                case Meta.MaximizeFlags.HORIZONTAL:
                    win.move_resize_frame(true,
                                          workArea.x,
                                          win.get_frame_rect().y,
                                          workArea.width,
                                          win.get_frame_rect().height);
                    break;
            }
        }
    }

    restoringWindow() {
        let windows = this.getWindows();

        for (let i = 0; i < windows.length; i++) {
            let actor = windows[i];
            let win = actor.get_meta_window();
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        }
    }

    getWindows() {
        let currentWorkspace = global.workspace_manager.get_active_workspace();

        let windows = global.get_window_actors().filter(actor => {
            if (actor.meta_window.get_window_type() == Meta.WindowType.NORMAL)
                return actor.meta_window.located_on_workspace(currentWorkspace);

            return false;
        });

        if (!(this._allMonitor)) {
            windows = windows.filter(w => {
                return w.meta_window.get_monitor() == this.getFocusedMonitor();
            });
        }
        return windows;
    }

    getFocusedMonitor() {
        let focusWindow = global.display.get_focus_window();
        return focusWindow.get_monitor();
    }

    getWorkArea(window) {
        if (this._allMonitor)
            return window.get_meta_window().get_work_area_all_monitors();
        else
            return window.get_meta_window().get_work_area_current_monitor();
    }

    _allMonitorToggle() {
        this._allMonitor = this._allMonitorItem.state;
        this._gsettings.set_boolean(ALL_MONITOR, this._allMonitorItem.state);
    }

    _getCustIcon(icon_name) {
        let gicon = Gio.icon_new_for_string( Me.dir.get_child('icons').get_path() + "/" + icon_name + ".svg" );
        return gicon;
    }

    addKeybinding() {
        let ModeType = Shell.hasOwnProperty('ActionMode') ?
                       Shell.ActionMode : Shell.KeyBindingMode;

        Main.wm.addKeybinding(HOTKEY_CASCADE,
                              this._gsettings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              this.cascadeWindow.bind(this),
                              );
        Main.wm.addKeybinding(HOTKEY_TILE,
                              this._gsettings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              this.tileWindow.bind(this),
                              );
        Main.wm.addKeybinding(HOTKEY_SIDEBYSIDE,
                              this._gsettings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              this.sideBySideWindow.bind(this),
                              );
        Main.wm.addKeybinding(HOTKEY_STACK,
                              this._gsettings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              this.stackWindow.bind(this),
                              );
    }

    _onDestroy(){
        Main.wm.removeKeybinding(HOTKEY_CASCADE);
        Main.wm.removeKeybinding(HOTKEY_TILE);
        Main.wm.removeKeybinding(HOTKEY_SIDEBYSIDE);
        Main.wm.removeKeybinding(HOTKEY_STACK);
    }
});

let Column = GObject.registerClass(
class Column extends PanelMenu.SystemIndicator {
    _init() {
        super._init();

        this._gsettings = Convenience.getSettings(ARRANGEWINDOWS_SCHEMA);

        this._item = new PopupMenu.PopupBaseMenuItem({ activate: false });
        this.menu.addMenuItem(this._item);

        this._slider = new Slider.Slider(0);
        this._slider.connect('drag-end', this._sliderChanged.bind(this));

        let number = this._gsettings.get_int(COLUMN_NUMBER);
        this._slider.value = number / 6;
        this._label = new St.Label({ text: 'Tile x' + COLUMN[number] });

        this._item.add(this._label);
        this._item.add(this._slider);
    }

    _sliderChanged() {
        let number = Math.round(this._slider.value * 6);
        this._slider.value = number / 6;
        this._label.set_text('Tile x' + COLUMN[number]);
        this._gsettings.set_int(COLUMN_NUMBER, number);
    }
});

let arrange;

function init(metadata) {
        let theme = imports.gi.Gtk.IconTheme.get_default();
        theme.append_search_path(metadata.path + '/icons');
}

function enable() {
    arrange = new ArrangeMenu;
    Main.panel.addToStatusArea('arrange-menu', arrange);
}

function disable() {
    arrange.destroy();
}
