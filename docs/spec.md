# 概要

このファイルは、これから開発するものの仕様をまとめる場所です

## 機能要件

人格データの分類
./docs/persona-status-data.md
上記のファイルにあるようなレベル分けに従って、人格データを分類する仕組みを実装する

まずは、RDBで管理されるデータを整理する

## データベース設計

RDBの命名規則は以下とする

Lv1-1: quantity_unchange_statuses
Lv1-2: semiquantity_unchange_statuses
Lv2: quantity_irreversible_statuses
Lv3-1: quantity_reversible_statuses
Lv3-2: semiquantity_reversible_statuses

