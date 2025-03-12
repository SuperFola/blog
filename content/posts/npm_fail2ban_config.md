+++
title = 'Nginx Proxy Manager and fail2ban behind CloudFlare to deny external traffic and ban bots'
date = 2024-10-12T12:54:45+02:00
tags = ['tooling', 'security', 'nginx']
categories = ['knowledge base']
+++

I think this is the longest title on my blog as of now.

This problem is highly specific to my setup and homelab, but that could help some people out there. What I want to achieve:
1. have CloudFlare serving as a proxy for my homelab, so that my IP address isn't directly accessible
2. rely on [nginx-proxy-manager](https://github.com/NginxProxyManager/nginx-proxy-manager) to create hosts on my homelab and serve them on the internet
3. ban abusers and bots using [fail2ban docker](https://github.com/crazymax/fail2ban)

## Using CloudFlare as a proxy

To address my first need, I followed this article: [How to combine Nginx Proxy Manager with Cloudflare to access your websites/webservices securely - Silicon's blog](https://silicon.blog/2024/01/22/how-to-combine-nginx-proxy-manager-with-cloudflare-to-access-your-websites-web-services-securely/), but I skipped the access list section. In my proxy host configuration, access list is set to "Publicly Accessible".

This last step is important because we toggled [Authenticated Origin Pulls (mTLS)](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull).

## Banning abusers and bots using fail2ban

To address my third need, I followed [Configuring Fail2ban with Nginx Proxy Manager (NPM)](https://blog.lrvt.de/fail2ban-with-nginx-proxy-manager/). This blog post walks you through enabling `set_real_ip_from <cloudflare ip>` and `real_ip_header ...`, that will inevitably make [nginx access lists not work](https://superuser.com/questions/960454/how-do-i-use-allow-deny-in-conjunction-with-set-real-ip-from). This is because nginx will try to match your **real** IP address with the list, instead of Cloudflare IP.

However, thanks to the **Authenticated Origin Pulls** we enabled earlier, we can skip this (see [this post on Cloudflare forum](https://community.cloudflare.com/t/nginx-forward-real-ip-and-only-allow-cloudflare/232570/6)) access list, and still have the benefit of having the **real** IP address in our nginx logs, so that fail2ban can be useful and ban abusers.

