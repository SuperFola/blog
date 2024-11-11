+++
title = 'Making a light alarm with Arduino'
date = 2024-11-11T17:42:00+02:00
tags = ['arduino']
categories = ['diy']
+++

A few years back, I wanted to try my hand at making my own alarm clock, but using light to wake me up (basically, DIY domotic?). All I had available to me was an Arduino and a lighting garland (as well as a few other components: cables, resistors, diodes, potentiometers, LCD screen, relays).

![The components available to me for this project](/1.jpg)

## My goal

- Creating a somewhat accurate clock using an Arduino
- Being able to set the clock time
- Turning on and off the light (on when the alarm starts, off when pressing a button for `x` seconds)

## Disassembling the garland

The garland works on batteries, but has a physical switch. For this project I needed to bypass that switch, to control it via software, and feed it power via a relay. All that was needed to do is to remove the batteries, carefully extract the cable, and solder new cables on it to link that to the relay.

![](/0.jpg) ![](/2.jpg) ![](/3.jpg) ![](/4.jpg)

_Bypassing the toggle of the garland_

## Installing the relay

So far, no code has been written, none has been required either. This will now change!

```cpp
const int ledPin = 7;

void setup() {
  // set our led garland relay pin as an output
  // so that we can control its state
  // default state will be 'LOW'
  pinMode(ledPin, OUTPUT);
}

void loop() {
  if (condition to turn on the relay and light) {
    // turn on the light
    digitalWrite(ledPin, HIGH);
  }
}
```

![Testing the relay and garland](/5.jpg)

Here you can see the relay connected to the batteries: it acts as a flood gate, stopping the current of the batteries from going through it. When we set the pin to `HIGH`, the gates open, the electricity flows and the circuit is closed: the light turns on.

## Setting up the clock

First, I'll need to setup a LCD screen, to display the time (and be able to set the clock time without reflashing the Arduino).

```cpp
#include <LiquidCrystal.h>

const int rs = 12, en = 11, d4 = 5, d5 = 4, d6 = 3, d7 = 2;
const int backlight = 8;
LiquidCrystal lcd(rs, en, d4, d5, d6, d7);

const int ledPin = 7;

void setup() {
  // my lcd is 16 chars wide and 2 lines tall!
  lcd.begin(16, 2);

  pinMode(ledPin, OUTPUT);
  pinMode(backlight, OUTPUT);
}


void loop() {
  // ...
}
```

With a few lines of boilerplate and some cables, we can connect the LCD and then will be able to control it via the `led` variable. We will also need some way to keep track of the time, the alarm time, and the mode it's in (running vs setting the time):

```cpp
// the number of clicks on the button
int clicks = 0;
bool shouldStartAlarm = false;
unsigned long setTime = 0;

enum UnitToSet {
  UnitNone = 0,
  UnitHours = 1,
  UnitMinutes = 2,
  UnitEnd = 3
};

// by default, the clock is running, we're not
// setting anything
int currentUnitToSet = UnitNone;

struct time_t {
  int hours = 0;
  int minutes = 0;
  int seconds = 0;

  time_t(int h, int m, int s) :
    hours(h), minutes(m), seconds(s)
  {}
};

// default values for the time and the fixed
// alarm time (24 hours format)
time_t currentTime {19, 0, 0};
time_t alarmTime {7, 10, 0};

void setup() {
  // ...
  pinMode(buttonPin, INPUT);
}

void loop() {
  // ...
}
```

### Tracking time

To be as accurate as possible, we need to be careful around the timing of the operations in our `loop()`. I want a 1 second cycle, not a 1004ms nor a 978ms cycle. For that, I used `millis()` and the old trick of having a varying delay:

```cpp
void loop() {
  unsigned long start = millis();

  // check snooze button
  int buttonState = digitalRead(buttonPin);

  // check if we should start the alarm
  if (currentTime.hours == alarmTime.hours &&
      currentTime.minutes == alarmTime.minutes &&
      currentTime.seconds == alarmTime.seconds) {
    shouldStartAlarm = true;
  }

  if (shouldStartAlarm) {
    digitalWrite(ledPin, HIGH);
    // light up the lcd screen
    digitalWrite(backlight, HIGH);

    // check the button state once per second
    // (due to our delay below)
    // if the button is pressed for 2 seconds
    // or more, disable the alarm
    if (buttonState == HIGH) {
      clicks++;
    }

    // snooze alarm
    if (clicks >= 2) {
      shouldStartAlarm = false;
      clicks = 0;
    }
  }

  // LCD backlight off if "set time" mode isn't on,
  // if alarm isn't running
  if (setTime == 0 && !shouldStartAlarm) {
    digitalWrite(backlight, LOW);
  } else {
    digitalWrite(backlight, HIGH);
  }

  // display time
  lcd.setCursor(0, 0);
  displayTime(currentTime.hours, currentTime.minutes, currentTime.seconds);

  // keep track of time
  if (setTime == 0) {
    delay(1000 + start - millis());

    // update the time!
    currentTime.seconds++;
    if (currentTime.seconds != 0 && currentTime.seconds % 60 == 0) {
      currentTime.minutes++;
      currentTime.seconds = 0;
    }
    if (currentTime.minutes != 0 && currentTime.minutes % 60 == 0) {
      currentTime.hours++;
      currentTime.minutes = 0;
    }
    if (currentTime.hours % 24 == 0) {
      currentTime.hours = 0;
    }
  } else {
    // shorter delay when in "set time" mode
    delay(250);
  }
}
```

Displaying time is easy, with a few calls to the LiquidCrystal Arduino library:

```cpp
void displayTime(int hours, int minutes, int seconds) {
  if (hours < 10) {
    lcd.write('0');
  }
  lcd.print(hours);
  lcd.write(':');

  if (minutes < 10) {
    lcd.write('0');
  }
  lcd.print(minutes);
  lcd.write(':');

  if (seconds < 10) {
    lcd.write('0');
  }
  lcd.print(seconds);
}
```

### Setting the time on the clock

With a press on the button (outside the alarm turning on state), I wanted to be able to set the time, and interactively see it being set. Having only a single button to play with, it will be a combination of timings and button presses to interact with the clock, nothing fancy like a rotating encoder.

```cpp
void loop() {
  // ...

  if (setTime == 0) {
    digitalWrite(ledPin, LOW);
    // if the alarm is not running and the button is pressed,
    // enter "set time" mode
    if (buttonState == HIGH) {
      // to remember when we started the mode
      setTime = millis();
      currentUnitToSet = UnitHours;
      // reset seconds
      currentTime.seconds = 0;
    }
  }

  if (setTime != 0) {
    // show which units are being set
    lcd.setCursor(0, 1);
    if (currentUnitToSet == UnitHours) {
      lcd.print("^^   ");
    } else if (currentUnitToSet == UnitMinutes) {
      lcd.print("   ^^");
    }

    if (buttonState == HIGH) {
      if (currentUnitToSet == UnitHours) {
        currentTime.hours = (currentTime.hours + 1) % 24;
      } else if (currentUnitToSet == UnitMinutes) {
        currentTime.minutes = (currentTime.minutes + 1) % 60;
      }
      setTime = millis();
    } else if (buttonState == LOW && millis() - setTime > 2000) {
      // if no button press after more than a second, go to next unit
      if (currentUnitToSet != UnitEnd) {
        currentUnitToSet++;
        setTime = millis();
      } else {
        // if we cycled through all the units,
        // then the clock is set
        setTime = 0;
        currentUnitToSet = UnitNone;
      }
    }
  }
}
```

## Full build

![](/6.jpg) ![](/7.jpg)

{{< video src="/result.mp4" >}}
