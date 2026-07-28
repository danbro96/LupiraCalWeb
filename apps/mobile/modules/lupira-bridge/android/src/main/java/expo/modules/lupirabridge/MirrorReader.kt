package expo.modules.lupirabridge

import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject

/// Read-side projection of the RN mirror for the publisher. Parses the stored doc JSON — the mirror's
/// scalar columns don't carry description/location/membership, the doc does.

data class MirrorCalendar(val id: String, val displayName: String, val color: Int)

data class MirrorItem(
  val id: String,
  val calendarId: String,      // first accepted membership — the provider calendar that hosts the event
  val title: String,
  val description: String?,
  val location: String?,
  val cancelled: Boolean,
  val allDay: Boolean,
  val startMs: Long,
  val endMs: Long?,            // exclusive; null = open-ended
  val rrule: String?,
)

object MirrorReader {
  fun calendars(db: SQLiteDatabase): List<MirrorCalendar> =
    db.rawQuery("SELECT id, doc FROM calendars", null).use { c ->
      val out = mutableListOf<MirrorCalendar>()
      while (c.moveToNext()) {
        val doc = JSONObject(c.getString(1))
        out.add(
          MirrorCalendar(
            id = c.getString(0),
            displayName = doc.optString("displayName").ifEmpty { c.getString(0) },
            color = parseColor(doc.optString("color")),
          ),
        )
      }
      out
    }

  fun items(db: SQLiteDatabase): List<MirrorItem> =
    db.rawQuery("SELECT id, doc FROM items WHERE deleted = 0", null).use { c ->
      val out = mutableListOf<MirrorItem>()
      while (c.moveToNext()) {
        val doc = JSONObject(c.getString(1))
        val item = fromDoc(c.getString(0), doc) ?: continue
        out.add(item)
      }
      out
    }

  private fun fromDoc(id: String, doc: JSONObject): MirrorItem? {
    val calendarId = firstAccepted(doc) ?: return null   // proposed-only items stay out of the provider
    val allDay = doc.optBoolean("isAllDay", false)
    val startMs: Long
    var endMs: Long?
    if (allDay) {
      val startDate = doc.optStringOrNull("startDate") ?: return null
      startMs = dayUtcMs(startDate)
      endMs = doc.optStringOrNull("endDate")?.let { dayUtcMs(it) }
    } else {
      val startsAt = doc.optStringOrNull("startsAt") ?: return null
      startMs = java.time.Instant.parse(startsAt).toEpochMilli()
      endMs = doc.optStringOrNull("endsAt")?.let { java.time.Instant.parse(it).toEpochMilli() }
    }
    if (endMs != null && endMs <= startMs) endMs = null
    return MirrorItem(
      id = id,
      calendarId = calendarId,
      title = doc.optStringOrNull("title") ?: "(untitled)",
      description = doc.optStringOrNull("description"),
      location = doc.optStringOrNull("locationLabel"),
      cancelled = doc.optStringOrNull("status") == "Cancelled",
      allDay = allDay,
      startMs = startMs,
      endMs = endMs,
      rrule = doc.optStringOrNull("recurrenceRule")?.removePrefix("RRULE:"),
    )
  }

  private fun firstAccepted(doc: JSONObject): String? {
    val memberships = doc.optJSONArray("calendars") ?: return null
    for (i in 0 until memberships.length()) {
      val m = memberships.optJSONObject(i) ?: continue
      if (m.optString("status") == "Accepted") return m.optStringOrNull("calendarId")
    }
    return null
  }

  private fun dayUtcMs(day: String): Long = java.time.LocalDate.parse(day.take(10))
    .atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli()

  private fun parseColor(hex: String?): Int {
    if (hex.isNullOrBlank()) return 0xFF4457C2.toInt()
    return try {
      android.graphics.Color.parseColor(hex)
    } catch (_: IllegalArgumentException) {
      0xFF4457C2.toInt()
    }
  }
}

private fun JSONObject.optStringOrNull(key: String): String? =
  if (isNull(key)) null else optString(key).ifEmpty { null }
