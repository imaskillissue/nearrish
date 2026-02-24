package com.nearrish.backend.entity;

import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

import java.util.HashMap;

@Entity
public class Role {
    @Id
    private String name;
    @ElementCollection
    private HashMap<String, Short> permissions;

    public Role(String name) {
        this.name = name;
    }

    public Role() {

    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public HashMap<String, Short> getPermissions() {
        return permissions;
    }

    public void setPermission(String permission, short value) {
        if (permissions == null) {
            permissions = new HashMap<>();
        }
        permissions.put(permission, value);
    }

    public boolean hasPermission(String permission) {
        if (permissions == null) {
            return false;
        }
        return permissions.getOrDefault(permission, (short) 0) > 0;
    }

    public boolean hasPermission(String permission, short requiredLevel) {
        if (permissions == null) {
            return false;
        }
        return permissions.getOrDefault(permission, (short) 0) >= requiredLevel;
    }
}
