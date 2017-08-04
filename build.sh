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
    echo "replace app.ini by [ $INI_FILE ]"
    cp $INI_FILE source/config/app.ini
fi

#PLATFORMS=(linux win32 darwin)
PLATFORMS=(darwin)
ARCH=x64

for PLATFORM in ${PLATFORMS[@]}; do

  if [ -d pwstore-${PLATFORM}-${ARCH} ]; then
    rm -rf pwstore-${PLATFORM}-${ARCH}
  fi
  OPTIONS="--platform=${PLATFORM} --arch=${ARCH} --app-version=${VERSION}"
  if [ "${PLATFORM}" = "darwin" ]; then
    OPTIONS="${OPTIONS} --icon=icons/pwstore.icns"
  fi
  source/node_modules/.bin/electron-packager source pwstore ${OPTIONS}
done

if [ "$INI_FILE" != "" ]; then
    echo "restore app.ini git [ checkout HEAD ]"
    git checkout HEAD source/config/app.ini
fi
