package com.oolshik.aan.phonenumberhint

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.ApiException
import com.google.android.gms.common.api.CommonStatusCodes

class PhoneNumberHintModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    private const val MODULE_NAME = "OolshikPhoneNumberHint"
    private const val REQUEST_CODE_PHONE_NUMBER_HINT = 11138
  }

  private var pendingPromise: Promise? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = MODULE_NAME

  @ReactMethod
  fun requestPhoneNumberHint(promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("ALREADY_IN_PROGRESS", "A phone number hint request is already running.")
      return
    }

    val activity = getCurrentActivity()
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No active Android activity is available.")
      return
    }

    val playServicesStatus =
      GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(activity)
    if (playServicesStatus != ConnectionResult.SUCCESS) {
      promise.reject(
        "PLAY_SERVICES_UNAVAILABLE",
        "Google Play Services is unavailable on this device.",
      )
      return
    }

    pendingPromise = promise

    val request = GetPhoneNumberHintIntentRequest.builder().build()
    Identity.getSignInClient(activity)
      .getPhoneNumberHintIntent(request)
      .addOnSuccessListener { pendingIntent ->
        try {
          activity.startIntentSenderForResult(
            pendingIntent.intentSender,
            REQUEST_CODE_PHONE_NUMBER_HINT,
            null,
            0,
            0,
            0,
            null,
          )
        } catch (error: IntentSender.SendIntentException) {
          rejectPendingPromise(
            "ACTIVITY_LAUNCH_FAILED",
            "Unable to launch the phone number hint picker.",
            error,
          )
        }
      }
      .addOnFailureListener { error ->
        if (error is ApiException) {
          when (error.statusCode) {
            CommonStatusCodes.CANCELED -> {
              rejectPendingPromise("USER_CANCELLED", "Phone number hint was cancelled.", error)
            }

            CommonStatusCodes.API_NOT_CONNECTED -> {
              rejectPendingPromise(
                "PLAY_SERVICES_UNAVAILABLE",
                "Google Play Services is unavailable on this device.",
                error,
              )
            }

            CommonStatusCodes.RESOLUTION_REQUIRED -> {
              rejectPendingPromise(
                "HINT_UNAVAILABLE",
                "Phone number hint is not enabled on this device right now.",
                error,
              )
            }

            CommonStatusCodes.NETWORK_ERROR -> {
              rejectPendingPromise(
                "NETWORK_ERROR",
                "A network error blocked the phone number hint request.",
                error,
              )
            }

            CommonStatusCodes.SIGN_IN_REQUIRED -> {
              rejectPendingPromise(
                "SIGN_IN_REQUIRED",
                "A Google account with phone number sharing is required for phone number hint.",
                error,
              )
            }

            CommonStatusCodes.DEVELOPER_ERROR -> {
              rejectPendingPromise(
                "DEVELOPER_ERROR",
                "Phone number hint is misconfigured for this Android build.",
                error,
              )
            }

            else -> {
              rejectPendingPromise(
                "API_ERROR",
                "Phone number hint failed before the picker could open.",
                error,
              )
            }
          }
          return@addOnFailureListener
        }

        rejectPendingPromise("UNKNOWN_ERROR", "Phone number hint failed unexpectedly.", error)
      }
  }

  override fun onActivityResult(
    activity: Activity,
    requestCode: Int,
    resultCode: Int,
    data: Intent?,
  ) {
    if (requestCode != REQUEST_CODE_PHONE_NUMBER_HINT) return

    val promise = pendingPromise ?: return
    pendingPromise = null

    if (resultCode != Activity.RESULT_OK || data == null) {
      promise.reject("USER_CANCELLED", "Phone number hint was cancelled.")
      return
    }

    try {
      val phoneNumber = Identity.getSignInClient(reactApplicationContext).getPhoneNumberFromIntent(data)
      if (phoneNumber.isBlank()) {
        promise.reject("GET_PHONE_NUMBER_FAILED", "No phone number was returned from the picker.")
        return
      }

      promise.resolve(phoneNumber)
    } catch (error: Exception) {
      promise.reject(
        "GET_PHONE_NUMBER_FAILED",
        "Unable to read the selected phone number from the picker result.",
        error,
      )
    }
  }

  override fun onNewIntent(intent: Intent) = Unit

  private fun rejectPendingPromise(code: String, message: String, error: Throwable?) {
    val promise = pendingPromise ?: return
    pendingPromise = null
    promise.reject(code, message, error)
  }
}
