+++
title = 'Rambling about USB-C'
date = 2024-10-07T19:50:00+02:00
tags = ['hardware']
categories = []
image = '/USB_2022_September_naming_scheme.png'
+++

## A bit of context...

Recently, more and more tech have been switching to USB C as its default connector to do pretty much everything, from charging, to transfering data, and even audio (thanks Apple!).

While it's great to have only a single cable for everything, I quickly discovered (as many other did) that not all cables were created equal. Some support charge up to 5W, others up to 15W, some will support USB 2 transfer speed, other would support audio and video... and to add insult to the injury the naming scheme is pretty much non-existent and very hard to follow.

On the following diagram you can see all the USB symbols and their associated features. No one can remember that accurately!

![USB-C chart and features ; a big mess](/USB-C_chart.jpg)

## What is USB? (Universal Serial BUS)

![USB connector types](/usb-connector-types.jpg)

USB is a standard to exchange data and deliver power. Both physical architecture and communication protocols are standardized, and yes power delivery needs a communication protocol (it isn't as simple as sending current on some pins, see [USB power delivery - Wikipedia](https://en.wikipedia.org/wiki/USB_hardware#USB_Power_Delivery)). What is going to be interesting for us is USB-C:

![USB 2022 September naming scheme - Wikipedia](/USB_2022_September_naming_scheme.png)

Again, it's quite a mess of symbols and what's available with what specification. USB-4 (released in August 2019) isn't even on the diagram!

> [!NOTE]
> USB4 is only applicable to USB-C.

## Our favorite connector, USB-C

This little reversible connector dates from August 2014, more than 10 years as of writing. Also called USB Type-C, it's a 24 pin connector, not a protocol! The C designation is to differentiate it from USB Type-A and Type-B.

The confusion begins here, as a single connector is used by multiple protocols, like Thunderbolt, PCIe, HDMI, DisplayPorts... It is not necessary to implement any USB transfer protocol or USB Power Delivery to use the connector, adding even more to the confusion when looking in your cable drawer.

Even though the cable appears to be symmetric, it isn't electrically! According to the specifications, "Determination of this host-to-device relationship is accomplished through a Configuration Channel (CC) that is connected through the cable."[1]

![USB C Plug pinout](/USB_Type-C_plug_pinout.png)

> [!NOTE]
> Did you know USB-C cables have 18 wires, but the connector has 24?
> **GND** is connected to **A1**, **B12**, **B1** and **A12**.
> **VBus** (power) is connected to **A4**, **B9**, **B4** and **A9**.

> [!IMPORTANT]
> A USB Type-C cable is called **full-featured** when it has all the wires connected. Some USB-C cables are USB-C due to their use of the connector, but only have ground and vbus cables, thus they aren't full-featured!

### Alternate mode

As you know, some USB-C cables can be used for more than charging and transfering data. This is digging into "Alternate modes": some pins & wires of the cable are reused to transfer non-USB data, like video or audio! The currently supported modes are:

- Thunderbolt 3 and later
    - TB3 carries DisplayPort 1.2, 1.4, USB 3.1 gen 2
    - TB4 carries DisplayPort 2.0, USB4
    - TB5 carries DisplayPort 2.1, USB4
- DisplayPort 1.2, 1.4, 2.0
- MHL (Mobile High-Definition Link) 1.0, 2.0, 3.0

Those alternate modes are (usually) supported by any full-featured end to end USB-C cables (not USB-C to A).

> [!NOTE]
> If you have those Thunderbolt cables, you're good to go, they support everything you need from audio, video, charging and data.
> **However** your computer USB-C ports might not support Thunderbolt, look for the bolt symbol on your equipment!

## USB-C weirdness?

Not all USB-C cables are created equal! You can in fact have a non-reversible USB-C cable, where the wires are only connected to one sides of the pins ; pins can also be damaged, causing the cable to not work in a specific orientation. You could also be missing a resistor on the CC pin, which is there to require power from the host.

It's also possible to have a USB-C cable with the bare minimum in term of pins and wires, and get at most 5W charging and not the 60-100-240W you expect from your charger. Your best bet would be to acquire a cable tester.

## TL;DR

1. Get those high-end Thunderbolt cables and you won't have any problems in most case
2. If you have connectivity issues, check that your dock, computer, or other equipment support Thunderbolt or DisplayPort over USB-C (their logo should be near the port or on the box when you bought said equipment)
3. Get a USB-C cable tester ([this Reddit thread](https://www.reddit.com/r/UsbCHardware/comments/16qlkd2/is_there_a_good_usb_c_cable_tester/) mentions the *FNIRSI FNB58*)

## Sources

1. [USB-C — Wikipedia](https://en.wikipedia.org/wiki/USB-C)
2. [USB - Wikipedia](https://en.wikipedia.org/wiki/USB)
3. [What can cause a USB-C cable to work in only one direction? — Quora](https://www.quora.com/What-can-cause-a-USB-C-cable-to-work-in-only-one-direction-My-Pixelbook-with-a-45-W-Google-charger-only-charges-with-a-cable-in-one-direction-Reversing-the-cable-does-not-change-it)
4. [What are the Different Types of USB Connectors & Their Speeds - URTech.ca](https://www.urtech.ca/2018/02/solved-different-types-usb-connectors-speeds/)
5. [USB-C : la nouvelle norme - Elka Pieterman](https://www.elkapieterman.be/fr/nouvelles/usb-c-la-nouvelle-norme/247/)

