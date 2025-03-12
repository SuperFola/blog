+++
title = 'Restoring WireGuard configuration on MacOS'
date = 2025-03-12T20:40:45+02:00
tags = ['macos', 'wireguard', 'tooling']
categories = ['knowledge base']
+++

Tonight, I had a bit of a misadventure with WireGuard on MacOS. My Mac installed an update a few days ago, and as usual I didn't think much about it. While lying on the sofa, I tried to connect to one of my servers to update a project, so I went to my VPN, Wireguard and searched for my tunnel. But it wasn't there!

## Restoring your tunnels

According to the internet, this is something that can happen after a system update. Alas, WireGuard tunnels aren't stored in files (eg `/etc/wireguard` like on Linux) on MacOS but in your login keychain.

You will need to go through your Time Machine backups to fix this!

Luckily, I make a backup about once a month, though I'll do more of them now.

1. I just had to connect my Time Machine drive, and using Finder, navigate to `/Volumes/<my drive>/2025-02-10-110527/Users/<my user>/`.
2. Then I looked for the `Library` folder (the one at the root of the backup will have a `Keychains/` folder but for me it didn't have the `login.keychain-db` file): it won't be there, navigate to it by pressing `Cmd+Shift+G`, then typing `Library/Keychains`
3. Copy the whole content of the folder to a temporary folder, eg on your desktop. You should have copied a folder with a *UUID* name, a `login.keychain-db`, and a `metadata.keychain-db` at least.
4. Double click on **the copy of** `login.keychain-db` to open it inside Keychain Access.
5. It will appear under **Custom Keychains** on the left, right click it and unlock it.
6. Under **All items**, search for `WireGuard`: you will find your tunnels there. Their corresponding configuration is stored inside the password field (right click, copy password)
7. In the wireguard app, you can create new empty tunnels and copy paste the configurations you retrieved.

