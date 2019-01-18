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

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const CASCADE_WIDTH = 30;
const CASCADE_HEIGHT = 30;

const ARRANGEWINDOWS_SCHEMA = 'org.gnome.shell.extensions.arrangeWindows';
const ALL_MONITOR = 'all-monitors';

class ArrangeMenu extends PanelMenu.Button {
    constructor() {
        super(0.0, _("Arrange Windows"));

        this._gsettings = Convenience.getSettings(ARRANGEWINDOWS_SCHEMA);

        this._allMonitor = this._gsettings.get_boolean(ALL_MONITOR);

        let icon = new St.Icon({ icon_name: 'arrange-windows',
                                 style_class: 'system-status-icon' });
        this.actor.add_child(icon);

        this.menu.addAction(_("Cascade"),
                            () => this.cascadeWindow(),
                            "cascade-windows-symbolic");

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

        let workArea;
        if (windows.length > 0)
            workArea = this.getWorkArea(windows[0]);
        else
            return;

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

        let workArea;
        let width;
        if (windows.length > 0) {
            workArea = this.getWorkArea(windows[0]);
            width = Math.round(workArea.width / windows.length)
        } else {
            return;
        }

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

        let workArea;
        let height;
        if (windows.length > 0) {
            workArea = this.getWorkArea(windows[0]);
            height = Math.round(workArea.height / windows.length)
        } else {
            return;
        }

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

    maximizeWindow(direction) {
        let windows = this.getWindows();

        for (let i = 0; i < windows.length; i++) {
            let actor = windows[i];
            let win = actor.get_meta_window();
            win.maximize(direction);
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
}

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
