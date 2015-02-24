#!/bin/sh
tail -n 15 config/config.json.sample > config/config.json;
rm config/config.json.sample;
tail -n 4 node_modules/sharelib-digest/config/digest.key.json.sample > node_modules/sharelib-digest/config/digest.key.json;
rm node_modules/sharelib-digest/config/digest.key.json.sample;
mv node_modules/sharelib-digest/config/key.sample.jpg node_modules/sharelib-digest/config/key.jpg;
echo "Installation terminated, now edit config/config.json and node_modules/sharelib-digest/config/digest.key.json to set your own environment values";
