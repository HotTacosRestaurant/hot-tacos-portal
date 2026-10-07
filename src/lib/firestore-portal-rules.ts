/*
  REFERENCE ONLY — PORTAL DEL GRUPO CORPORATIVO

  This file is NOT deployed automatically and MUST NOT replace the complete
  Firestore rules file. It mirrors only the portal-related rules expected by
  this application.

  Administrative authorization is two-step:
  1) Firebase Authentication email/password signs the user in.
  2) Firestore must contain portal_users/{uid} with active=true and role='admin'.
  3) Only the hardcoded master emails may create/update portal_users entries.

  The complete Firestore rules also protect other Hot Tacos applications.
*/

export const FIRESTORE_PORTAL_RULES = `
function isPortalAdmin() {
  return
    request.auth != null &&
    exists(/databases/$(database)/documents/portal_users/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/portal_users/$(request.auth.uid)).data.active == true &&
    get(/databases/$(database)/documents/portal_users/$(request.auth.uid)).data.role == 'admin';
}

function isPortalSuperAdmin() {
  return
    isPortalAdmin() &&
    request.auth.token.email != null &&
    request.auth.token.email in [
      'hottacosmanagement@hotmail.com',
      'admin@nixinx.com',
      'admin@nixinex.com',
      'admin@hottacosrestaurant.com'
    ];
}

function isValidPortalUser() {
  return
    onlyKeys(['active', 'role', 'email', 'name']) &&
    request.resource.data.keys().hasAll(['active', 'role', 'email', 'name']) &&
    request.resource.data.active is bool &&
    request.resource.data.role == 'admin' &&
    isStringField(request.resource.data.email, 3, 160) &&
    isStringField(request.resource.data.name, 2, 160);
}

function isValidPortalStatus(value) {
  return value in [
    'notified',
    'in_progress',
    'under_review',
    'ready',
    'blocked'
  ];
}

function isValidPortalInitiative() {
  return
    onlyKeys([
      'title',
      'description',
      'monthKey',
      'eventDate',
      'location',
      'owner',
      'ownerPersonId',
      'ownerContact',
      'status',
      'scopeType',
      'unitIds',
      'areas',
      'createdAt',
      'updatedAt'
    ]) &&

    request.resource.data.keys().hasAll([
      'title',
      'description',
      'monthKey',
      'eventDate',
      'location',
      'owner',
      'status',
      'scopeType',
      'unitIds',
      'areas',
      'createdAt',
      'updatedAt'
    ]) &&

    isStringField(request.resource.data.title, 2, 180) &&
    isOptionalStringField(request.resource.data.description, 4000) &&
    request.resource.data.monthKey is string &&
    request.resource.data.monthKey.matches('^[0-9]{4}-(0[1-9]|1[0-2])$') &&
    request.resource.data.eventDate is string &&
    request.resource.data.eventDate.matches('^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$') &&
    isOptionalStringField(request.resource.data.location, 250) &&
    isStringField(request.resource.data.owner, 1, 160) &&

    (
      !request.resource.data.keys().hasAny(['ownerPersonId']) ||
      isOptionalStringField(request.resource.data.ownerPersonId, 160)
    ) &&

    (
      !request.resource.data.keys().hasAny(['ownerContact']) ||
      (
        request.resource.data.ownerContact is map &&
        request.resource.data.ownerContact.keys().hasOnly(['phone', 'email']) &&
        isOptionalStringField(request.resource.data.ownerContact.phone, 30) &&
        isOptionalStringField(request.resource.data.ownerContact.email, 160)
      )
    ) &&

    isValidPortalStatus(request.resource.data.status) &&
    request.resource.data.scopeType in ['brand', 'units'] &&
    request.resource.data.unitIds is list &&
    request.resource.data.unitIds.size() <= 20 &&
    (
      (request.resource.data.scopeType == 'brand' && request.resource.data.unitIds.size() == 0) ||
      (request.resource.data.scopeType == 'units' && request.resource.data.unitIds.size() >= 1)
    ) &&
    request.resource.data.areas is list &&
    request.resource.data.areas.size() >= 1 &&
    request.resource.data.areas.size() <= 20 &&
    isStringField(request.resource.data.createdAt, 20, 40) &&
    isStringField(request.resource.data.updatedAt, 20, 40);
}

match /portal_users/{userId} {
  allow get: if
    request.auth != null &&
    (request.auth.uid == userId || isPortalSuperAdmin());
  allow list: if isPortalSuperAdmin();
  allow create, update: if isPortalSuperAdmin() && isValidPortalUser();
  allow delete: if false;
}

match /portal_areas/{areaId} {
  allow read: if true;
  allow create, update: if
    isPortalAdmin() &&
    onlyKeys(['name', 'active', 'sortOrder', 'updatedAt']) &&
    isStringField(request.resource.data.name, 2, 120) &&
    request.resource.data.active is bool &&
    request.resource.data.sortOrder is int &&
    isStringField(request.resource.data.updatedAt, 20, 40);
  allow delete: if false;
}

match /portal_units/{unitId} {
  allow read: if true;
  allow create, update: if
    isPortalAdmin() &&
    onlyKeys(['code', 'name', 'active', 'sortOrder', 'updatedAt']) &&
    isStringField(request.resource.data.code, 2, 12) &&
    isStringField(request.resource.data.name, 2, 160) &&
    request.resource.data.active is bool &&
    request.resource.data.sortOrder is int &&
    isStringField(request.resource.data.updatedAt, 20, 40);
  allow delete: if false;
}

match /portal_people/{personId} {
  allow read: if true;
  allow create, update: if
    isPortalAdmin() &&
    onlyKeys(['name', 'role', 'phone', 'email', 'active', 'sortOrder', 'updatedAt']) &&
    isStringField(request.resource.data.name, 2, 160) &&
    isOptionalStringField(request.resource.data.role, 160) &&
    isOptionalStringField(request.resource.data.phone, 30) &&
    isOptionalStringField(request.resource.data.email, 160) &&
    request.resource.data.active is bool &&
    request.resource.data.sortOrder is int &&
    isStringField(request.resource.data.updatedAt, 20, 40);
  allow delete: if false;
}

match /portal_initiatives/{initiativeId} {
  allow read: if true;
  allow create: if
    isPortalAdmin() &&
    isValidPortalInitiative() &&
    request.resource.data.createdAt == request.resource.data.updatedAt;
  allow update: if
    isValidPortalInitiative() &&
    request.resource.data.createdAt == resource.data.createdAt &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'status',
      'areas',
      'updatedAt'
    ]);
  allow delete: if isPortalAdmin();
}
`;
