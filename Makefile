
schemas:
	glib-compile-schemas arrangeWindows@sun.wxg@gmail.com/schemas/

submit: schemas
	cd arrangeWindows@sun.wxg@gmail.com/ && zip -r ~/arrangeWindows.zip *

install:
	rm -rf ~/.local/share/gnome-shell/extensions/arrangeWindows@sun.wxg@gmail.com
	cp -r arrangeWindows@sun.wxg@gmail.com ~/.local/share/gnome-shell/extensions/

