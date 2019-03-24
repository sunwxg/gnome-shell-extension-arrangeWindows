// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const Gio = imports.gi.Gio;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const Tweener = imports.ui.tweener;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Conf = imports.misc.config;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const CASCADE_WIDTH = 30;
const CASCADE_HEIGHT = 30;
const MIN_WINDOW_WIDTH = 500;

const ARRANGEWINDOWS_SCHEMA = 'org.gnome.shell.extensions.arrangeWindows';
const ALL_MONITOR = 'all-monitors';

class ArrangeMenu extends PanelMenu.Button {
    constructor() {
        super(0.0, _("Arrange Windows"));

        this._gsettings = Convenience.getSettings(ARRANGEWINDOWS_SCHEMA);

        this._allMonitor = this._gsettings.get_boolean(ALL_MONITOR);

        let icon = new St.Icon({ icon_name: 'arrange-windows-symbolic',
                                 style_class: 'system-status-icon' });
        this.actor.add_child(icon);

        this.menu.addAction(_("Cascade"),
                            () => this.cascadeWindow(),
                            "cascade-windows-symbolic");

        this.menu.addAction(_("Tile"),
                            () => this.tileWindow(),
                            "tile-windows-symbolic");

        this.menu.addAction(_("Side by side"),
                            () => this.sideBySideWindow(),
                            "sidebyside-windows-symbolic");

        this.menu.addAction(_("Stack"),
                            () => this.stackWindow(),
                            "stack-windows-symbolic");

        this.menu.addAction(_("Maximize"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.BOTH),
                            "maximize-windows-symbolic");

        this.menu.addAction(_("Maximize Vertical"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.VERTICAL),
                            "maximize-vertical-windows-symbolic");

        this.menu.addAction(_("Maximize Horizontal"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.HORIZONTAL),
                            "maximize-horizontal-windows-symbolic");

        this.menu.addAction(_("Restoring"),
                            () => this.restoringWindow(),
                            "restoring-window-symbolic");

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._allMonitorItem = new PopupMenu.PopupSwitchMenuItem(_("All monitors"), this._allMonitor)
        this._allMonitorItem.connect('toggled', this._allMonitorToggle.bind(this));
        this.menu.addMenuItem( this._allMonitorItem );

        this.actor.show();
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
            win.move_resize_frame(true, x, y, width, workArea.height);
            x = x + win.get_frame_rect().width;
        }

        let last_win = windows[windows.length - 1].meta_window;
        x = last_win.get_frame_rect().x;
        last_win.move_resize_frame(false, x, y,
                                   workArea.x + workArea.width - x,
                                   workArea.height);
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
            win.move_resize_frame(true, x, y, workArea.width, height);
            y = y + win.get_frame_rect().height;
        }

        let last_win = windows[windows.length - 1].meta_window;
        y = last_win.get_frame_rect().y;
        last_win.move_resize_frame(false, x, y,
                                   workArea.width,
                                   workArea.y + workArea.height - y);
    }

    tileWindow() {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);

        let columnMaxNumber = 1;
        while ((workArea.width / columnMaxNumber) > MIN_WINDOW_WIDTH) {
            columnMaxNumber++;
        }

        let columnNumber = (windows.length < columnMaxNumber) ? windows.length : columnMaxNumber;
        let rowNumber = Math.floor(windows.length / columnNumber) + ((windows.length % columnNumber) > 0 ? 1 : 0);
        let width = Math.round(workArea.width / columnNumber)
        let height = Math.round(workArea.height/ rowNumber)
        let x = workArea.x;
        let y = workArea.y;

        for (let i = 0; i < windows.length; i++) {
            let row = Math.floor(i / columnNumber);
            let column = i % columnNumber;
            if (i == 0) {
                x = workArea.x + width * column;
                y = workArea.y + height * row;
            } else {
                x = workArea.x + (windows[i - 1].meta_window.get_frame_rect().width) * column;
                y = workArea.y + (windows[i - 1].meta_window.get_frame_rect().height) * row;
            }

            let win = windows[i].get_meta_window();
            win.unmaximize(Meta.MaximizeFlags.BOTH);
            win.move_resize_frame(true, x, y, width, height);
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
        let currentWorkspace;
        if (this.isLess30())
            currentWorkspace = global.screen.get_active_workspace();
        else
            currentWorkspace = global.workspace_manager.get_active_workspace();

        let windows = global.get_window_actors().filter(actor => {
            if (actor.meta_window.get_window_type() == Meta.WindowType.NORMAL)
                return actor.meta_window.located_on_workspace(currentWorkspace);

            return false;
        });

        if (!(this._allMonitor)) {
            windows = windows.filter(w => {
                if (this.isLess30())
                    return w.meta_window.get_monitor() == global.screen.get_current_monitor();
                else
                    return w.meta_window.get_monitor() == global.display.get_current_monitor();
            });
        }
        return windows;
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

    isLess30() {
        let version = Conf.PACKAGE_VERSION.split('.');
        if (version[0] == 3 && version[1] < 30)
            return true;

        return false;
    }
}

var arrange;

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
