#!/bin/bash

#npm install -g nw-gyp

npm link .

echo 'Rebuilding node-serialport using nw-gyp..'
cd node_modules/serialport
nw-gyp clean
nw-gyp configure --target=0.5.0
nw-gyp build
cd ../..

rm -rf mac/baseflight-configurator.app
cp -R mac/node-webkit.app mac/baseflight-configurator.app
cp mac/Info.plist mac/baseflight-configurator.app/Contents

zip -x "mac*" "win*" "linux*" -r \
  mac/baseflight-configurator.app/Contents/Resources/app.nw *
