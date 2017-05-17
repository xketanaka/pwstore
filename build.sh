#!/bin/bash

while getopts f:v: OPT
do
    case $OPT in
        f) INI_FILE=$OPTARG
          ;;
        v) VERSION=$OPTARG
          ;;
    esac
done

if [ "$VERSION" = "" ]; then

  printf "作成するアプリケーションのバージョンを指定してください(例: 1.2.3): "
  read VERSION

  [ "$VERSION" = "" ] && VERSION="0.1.0"
fi

if [ "$INI_FILE" != "" ] && [ -f $INI_FILE ]; then
    echo $INI_FILE
#    mv $INI_FILE source/config/app.ini
fi

[ -d pwstore-darwin-x64 ] && rm -rf pwstore-darwin-x64

source/node_modules/.bin/electron-packager source pwstore --platform=darwin --arch=x64 --app-version=$VERSION

if [ "$INI_FILE" != "" ]; then
    echo "done"
#    git checkout HEAD source/config/app.ini
fi
