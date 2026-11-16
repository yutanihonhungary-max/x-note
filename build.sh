#!/bin/sh
# index.html で使う Tailwind のクラスを tailwind.css に書き出す（クラスを増減したら実行）
set -e
TMP=$(mktemp -d)
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$TMP/in.css"
npx -y tailwindcss@3.4.17 -i "$TMP/in.css" -o tailwind.css --content index.html --minify
rm -rf "$TMP"
