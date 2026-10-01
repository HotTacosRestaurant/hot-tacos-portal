export const FIRESTORE_PORTAL_RULES = `/*
  PORTAL DEL GRUPO CORPORATIVO  
  Pegar dentro de match /databases/{database}/documents,
  inmediatamente ANTES de la regla final match /{document=**}.
*/

function isPortalUser() {
  return request.auth != null &&
    exists(/databases/$(database)/documents/portal_users/$(request.auth.uid)) &&
    get(/databases/$(database)/documents/portal_users/$(request.auth.uid)).data.active == true &&
    get(/databases/$(database)/documents/portal_users/$(request.auth.uid)).data.role in ['admin', 'manager', 'member'];
}

function isPortalAdmin() {
  return isPortalUser() &&
    get(/databases/$(database)/documents/portal_users/$(request.auth.uid)).data.role == 'admin';
}

function isValidPortalStatus(value) {
  return value in ['notified', 'in_progress', 'under_review', 'ready', 'blocked'];
}

function isValidPortalInitiative() {
  return onlyKeys([
      'title', 'description', 'monthKey', 'eventDate', 'location',
      'owner', 'status', 'scopeType', 'unitIds', 'areas',
      'createdAt', 'updatedAt'
    ]) &&
    request.resource.data.keys().hasAll([
      'title', 'description', 'monthKey', 'eventDate', 'location',
      'owner', 'status', 'scopeType', 'unitIds', 'areas',
      'createdAt', 'updatedAt'
    ]) &&
    isStringField(request.resource.data.title, 2, 180) &&
    isOptionalStringField(request.resource.data.description, 4000) &&
    request.resource.data.monthKey is string &&
    request.resource.data.monthKey.matches('^[0-9]{4}-(0[1-9]|1[0-2])$') &&
    request.resource.data.eventDate is string &&
    request.resource.data.eventDate.matches('^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[0-1])$') &&
    isOptionalStringField(request.resource.data.location, 250) &&
    isStringField(request.resource.data.owner, 1, 160) &&
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
  allow get: if isPortalUser() && request.auth.uid == userId;
  allow list, create, update, delete: if false;
}

match /portal_areas/{areaId} {
  allow read: if isPortalUser();
  allow create, update: if isPortalAdmin() &&
    onlyKeys(['name', 'active', 'sortOrder', 'updatedAt']) &&
    isStringField(request.resource.data.name, 2, 120) &&
    request.resource.data.active is bool &&
    request.resource.data.sortOrder is int &&
    isStringField(request.resource.data.updatedAt, 20, 40);
  allow delete: if false;
}

match /portal_units/{unitId} {
  allow read: if isPortalUser();
  allow create, update: if isPortalAdmin() &&
    onlyKeys(['code', 'name', 'active', 'sortOrder', 'updatedAt']) &&
    isStringField(request.resource.data.code, 2, 12) &&
    isStringField(request.resource.data.name, 2, 160) &&
    request.resource.data.active is bool &&
    request.resource.data.sortOrder is int &&
    isStringField(request.resource.data.updatedAt, 20, 40);
  allow delete: if false;
}

match /portal_initiatives/{initiativeId} {
  allow read: if isPortalUser();
  allow create: if isPortalUser() &&
    isValidPortalInitiative() &&
    request.resource.data.createdAt == request.resource.data.updatedAt;
  allow update: if isPortalUser() &&
    isValidPortalInitiative() &&
    request.resource.data.createdAt == resource.data.createdAt;
  allow delete: if isPortalUser();
}`;

