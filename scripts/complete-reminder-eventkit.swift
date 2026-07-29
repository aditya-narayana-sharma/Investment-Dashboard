#!/usr/bin/env swift
/**
 * Mark one incomplete Apple Reminder complete via EventKit.
 *
 * Usage: swift scripts/complete-reminder-eventkit.swift <listName> <title>
 *
 * EventKit sees lists AppleScript often omits (Watchlist, Download List, Wishlist).
 * Completions go through the real Reminders store and sync via iCloud.
 */
import EventKit
import Foundation

func stripNoise(_ raw: String) -> String {
  raw.lowercased()
    .filter { $0.isLetter || $0.isNumber || $0.isWhitespace }
    .split(whereSeparator: \.isWhitespace)
    .joined(separator: " ")
}

func fail(_ code: Int32, _ message: String) -> Never {
  fputs("\(message)\n", stderr)
  exit(code)
}

guard CommandLine.arguments.count >= 3 else {
  fail(2, "usage: complete-reminder-eventkit.swift <listName> <title>")
}

let targetList = CommandLine.arguments[1]
let targetTitle = CommandLine.arguments[2]
let store = EKEventStore()
let authSem = DispatchSemaphore(value: 0)
var authError: Error?

if #available(macOS 14.0, *) {
  store.requestFullAccessToReminders { granted, error in
    authError = error
    if !granted {
      authError = authError
        ?? NSError(
          domain: "InvestmentDashboard.Reminders",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Reminders Full Access was denied for EventKit."]
        )
    }
    authSem.signal()
  }
} else {
  store.requestAccess(to: .reminder) { granted, error in
    authError = error
    if !granted {
      authError = authError
        ?? NSError(
          domain: "InvestmentDashboard.Reminders",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Reminders access was denied for EventKit."]
        )
    }
    authSem.signal()
  }
}
authSem.wait()
if let authError {
  fail(1, "EventKit auth failed: \(authError.localizedDescription)")
}

let calendars = store.calendars(for: .reminder)
let strippedTarget = stripNoise(targetList)
guard
  let calendar =
    calendars.first(where: { $0.title == targetList })
    ?? calendars.first(where: { stripNoise($0.title) == strippedTarget })
else {
  let names = calendars.map(\.title).sorted().joined(separator: ", ")
  fail(3, "Reminders list not visible to EventKit: \(targetList). Visible lists: \(names)")
}

let predicate = store.predicateForIncompleteReminders(
  withDueDateStarting: nil,
  ending: nil,
  calendars: [calendar]
)
let fetchSem = DispatchSemaphore(value: 0)
var incomplete: [EKReminder] = []
store.fetchReminders(matching: predicate) { reminders in
  incomplete = reminders ?? []
  fetchSem.signal()
}
fetchSem.wait()

guard let match = incomplete.first(where: { ($0.title ?? "") == targetTitle }) else {
  fail(
    4,
    "No incomplete reminder named \"\(targetTitle)\" in list \"\(calendar.title)\" (EventKit saw \(incomplete.count) open item(s))."
  )
}

match.isCompleted = true
match.completionDate = Date()
do {
  try store.save(match, commit: true)
} catch {
  fail(5, "EventKit save failed: \(error.localizedDescription)")
}

print("ok")
