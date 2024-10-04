+++
title = 'Comparing USB C norms'
date = 2024-09-28T18:05:00+02:00
tags = ['hardware']
categories = []
+++

Recently, more and more tech have been switching to USB C as its default connector to do pretty much everything, from charging, to transfering data, even audio (thanks Apple!).

While it's great to have only a single cable for everything, I quickly discovered (as many other did) that not all cables were created equal. Some support charge up to 5W, others up to 15W, some will support USB 2 transfer speed, other would support audio and video... and to add insult to the injury the naming scheme is pretty much non-existent and very hard to follow.

schema with the versions
the different kind of connectors

## Universal Serial BUS (USB)

USB is a standard to exchange data and deliver power.

USB 3.0, 3.1, 3.2.

https://cdn.shopify.com/s/files/1/0257/5246/9566/t/59/assets/usb-version-1698032371731.png?v=1698032372

USB4 only applicable to USB-C.

### USB-C

Also called USB Type-C, it's a 24 pin connector, not a protocol! The confusion begins here, as a single connector is used by multiple protocols, like Thunderbolt, PCIe, HDMI, DisplayPorts... It is not necessary to implement any USB transfer protocol or USB Power Delivery to use the connector, adding even more to the confusion when looking in your cable drawer.

The C designation is to differentiate it from USB Type-A and Type-B.

Even though the cable appears to be symmetric, it isn't electrically! According to the specifications, "Determination of this host-to-device relationship is accomplished through a Configuration Channel (CC) that is connected through the cable."[1]

![USB C Plug pinout](/USB_Type-C_plug_pinout.png)

> [!NOTE]
> Did you know USB-C cables have 18 pins, but the connector has 24?
> **GND** is connected to **A1**, **B12**, **B1** and **A12**.
> **VBus** (power) is connected to **A4**, **B9**, **B4** and **A9**.

> [!IMPORTANT]
> A USB Type-C cable is called **full-featured** when it has all the wires connected. Some USB-C cables are USB-C due to their use of the connector, but only have ground and vbus cables, thus they aren't full-featured!

## Alternate mode USB-C

- Thunderbolt 3 and later
    - TB3 carries DisplayPort 1.2, 1.4, USB 3.1 gen 2
    - TB4 carries DisplayPort 2.0, USB4
    - TB5 carries DisplayPort 2.1, USB4
- DisplayPort 1.2, 1.4, 2.0
- MHL (mobile high-definition link) 1.0, 2.0, 3.0

Those alternate modes are supported by any full-featured USB-C cables

## USB-C Compatibility issues

### While charging

Not all USB-C cables are created equal! You can in fact have a non-reversible USB-C cable, where the wires are only connected to one sides of the pins ; pins can also be damaged, causing the cable to not work in a specific orientation. You could also be missing a resistor on the CC pin, which is there to require power from the host.

## Sources

1. [USB-C — Wikipedia](https://en.wikipedia.org/wiki/USB-C)
2. [USB - Wikipedia](https://en.wikipedia.org/wiki/USB)
3. [What can cause a USB-C cable to work in only one direction? — Quora](https://www.quora.com/What-can-cause-a-USB-C-cable-to-work-in-only-one-direction-My-Pixelbook-with-a-45-W-Google-charger-only-charges-with-a-cable-in-one-direction-Reversing-the-cable-does-not-change-it)

